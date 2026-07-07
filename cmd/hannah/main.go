package main

import (
	"bytes"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/evanw/esbuild/pkg/api"
	"github.com/fsnotify/fsnotify"
	"github.com/gorilla/websocket"
	"github.com/robertkrimen/otto/ast"
	"github.com/robertkrimen/otto/parser"
	"golang.org/x/net/html"
)

// ==========================================
// ---- Tipos ----
// ==========================================

type Binding struct {
	Path      []int
	Directive string
	Value     string
}

type ComponentCompiler struct {
	Name     string
	Bindings []Binding
	ScopeID  string
}

type AuxFunction struct {
	Name string
	Args []string
	Body string
}

var exprCounter int
var auxFunctions []AuxFunction

// ==========================================
// ---- Utilidades ----
// ==========================================

func toPascalCase(s string) string {
	parts := strings.Split(s, "-")
	var result strings.Builder
	for _, part := range parts {
		if len(part) > 0 {
			result.WriteString(strings.ToUpper(part[:1]) + part[1:])
		}
	}
	return result.String()
}

func isSignalReference(val string) bool {
	matched, _ := regexp.MatchString(`^[a-zA-Z_$][a-zA-Z0-9_$]*$`, val)
	return matched
}

// ==========================================
// ---- Normalización de HTML ----
// ==========================================

func NormalizeTree(n *html.Node) {
	var next *html.Node
	for ch := n.FirstChild; ch != nil; ch = next {
		next = ch.NextSibling
		if ch.Type == html.TextNode {
			if strings.TrimSpace(ch.Data) == "" {
				n.RemoveChild(ch)
				continue
			}
		}
		NormalizeTree(ch)
	}
}

// CSSRule representa una regla CSS parseada
type CSSRule struct {
	Selector   string
	Properties string
	IsAtRule   bool
	AtRuleType string // "media", "keyframes", etc.
	Children   []*CSSRule
}

// ParseCSS analiza CSS completo incluyendo @media, @keyframes y selectores anidados
func ParseCSS(css string) []*CSSRule {
	var rules []*CSSRule

	// Regex para capturar bloques completos (incluyendo anidados)
	blockRegex := regexp.MustCompile(`(?s)(@?[^{]+)\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}`)
	matches := blockRegex.FindAllStringSubmatch(css, -1)

	for _, match := range matches {
		if len(match) < 3 {
			continue
		}

		selector := strings.TrimSpace(match[1])
		content := strings.TrimSpace(match[2])

		rule := &CSSRule{
			Selector: selector,
		}

		// Detectar si es una @-rule
		if strings.HasPrefix(selector, "@") {
			rule.IsAtRule = true
			if strings.HasPrefix(selector, "@media") {
				rule.AtRuleType = "media"
				rule.Children = ParseCSS(content)
			} else if strings.HasPrefix(selector, "@keyframes") {
				rule.AtRuleType = "keyframes"
				rule.Children = ParseCSS(content)
			} else {
				rule.Properties = content
			}
		} else {
			rule.Properties = content
		}

		rules = append(rules, rule)
	}

	return rules
}

// ScopeCSSAdvanced aplica Scoped CSS con soporte completo para BEM y @-rules
func ScopeCSSAdvanced(css string, scopeId string) string {
	if strings.TrimSpace(css) == "" {
		return ""
	}

	rules := ParseCSS(css)
	var result strings.Builder

	for _, rule := range rules {
		result.WriteString(scopeRule(rule, scopeId, 0))
	}

	return result.String()
}

// scopeRule aplica el scope a una regla individual
func scopeRule(rule *CSSRule, scopeId string, depth int) string {
	var result strings.Builder
	indent := strings.Repeat("  ", depth)

	if rule.IsAtRule {
		result.WriteString(indent + rule.Selector + " {\n")

		if rule.AtRuleType == "media" || rule.AtRuleType == "keyframes" {
			for _, child := range rule.Children {
				result.WriteString(scopeRule(child, scopeId, depth+1))
			}
		} else if rule.Properties != "" {
			result.WriteString(indent + "  " + rule.Properties + "\n")
		}

		result.WriteString(indent + "}\n\n")
	} else {
		scopedSelectors := scopeSelector(rule.Selector, scopeId)
		result.WriteString(indent + scopedSelectors + " {\n")
		result.WriteString(indent + "  " + rule.Properties + "\n")
		result.WriteString(indent + "}\n\n")
	}

	return result.String()
}

// scopeSelector aplica el atributo de scope a un selector
func scopeSelector(selector string, scopeId string) string {
	selectors := strings.Split(selector, ",")
	var scopedSelectors []string

	for _, sel := range selectors {
		sel = strings.TrimSpace(sel)

		if sel == "" || sel == ":root" || sel == "html" || sel == "body" {
			scopedSelectors = append(scopedSelectors, sel)
			continue
		}

		parts := strings.Fields(sel)
		if len(parts) > 0 {
			parts[0] = applyScopeToSelector(parts[0], scopeId)

			for i := 1; i < len(parts); i++ {
				if strings.HasPrefix(parts[i], ":") {
					parts[i-1] = applyScopeToSelector(parts[i-1], scopeId)
				}
			}

			scopedSelectors = append(scopedSelectors, strings.Join(parts, " "))
		}
	}

	return strings.Join(scopedSelectors, ", ")
}

// applyScopeToSelector aplica el atributo de scope a un selector individual
func applyScopeToSelector(selector string, scopeId string) string {
	if strings.Contains(selector, "["+scopeId+"]") {
		return selector
	}

	pseudoRegex := regexp.MustCompile(`(::?[a-zA-Z-]+(?:\([^)]*\))?)$`)

	if pseudoRegex.MatchString(selector) {
		parts := pseudoRegex.FindStringSubmatch(selector)
		baseSelector := strings.TrimSuffix(selector, parts[0])
		pseudoPart := parts[0]
		return baseSelector + "[" + scopeId + "]" + pseudoPart
	}

	return selector + "[" + scopeId + "]"
}

// ==========================================
// ---- Traverse modularizada ----
// ==========================================

func (cc *ComponentCompiler) Traverse(n *html.Node, currentPath []int, itemName string) {
	if n.Type == html.ElementNode {
		n.Attr = append(n.Attr, html.Attribute{Key: cc.ScopeID, Val: ""})

		// Detectar h-each para actualizar itemName
		currentItemName := cc.detectEachItemName(n)
		if currentItemName != "" {
			itemName = currentItemName
		}

		// Procesar atributos
		cc.processAttributes(n, currentPath, itemName)
	}

	// Recorrer hijos
	childIdx := 0
	for ch := n.FirstChild; ch != nil; ch = ch.NextSibling {
		nextPath := append(currentPath, childIdx)
		cc.Traverse(ch, nextPath, itemName)
		childIdx++
	}
}

func (cc *ComponentCompiler) detectEachItemName(n *html.Node) string {
	for _, attr := range n.Attr {
		if attr.Key == "h-each" {
			reEach := regexp.MustCompile(`^\s*(\w+)\s+in\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*$`)
			matches := reEach.FindStringSubmatch(attr.Val)
			if len(matches) == 3 {
				return matches[1]
			}
		}
	}
	return ""
}

func (cc *ComponentCompiler) processAttributes(n *html.Node, currentPath []int, itemName string) {
	for i, attr := range n.Attr {
		if !strings.HasPrefix(attr.Key, "h-") {
			continue
		}
		key := attr.Key
		val := attr.Val

		// Directivas AOT (bindings)
		if cc.isAOTDirective(key) && !cc.isSkippedDirective(key) {
			cc.Bindings = append(cc.Bindings, Binding{
				Path:      append([]int(nil), currentPath...),
				Directive: key,
				Value:     val,
			})
		}

		// Expresiones (h-bind:class, h-bind:style)
		if cc.isExpressionDirective(key) && !isSignalReference(val) {
			exprCode, err := parseExpression(val, itemName)
			if err == nil {
				exprCounter++
				funcName := fmt.Sprintf("__expr_%s_%d", cc.Name, exprCounter)
				auxFunctions = append(auxFunctions, AuxFunction{
					Name: funcName,
					Args: []string{"ctx"},
					Body: fmt.Sprintf("return %s;", exprCode),
				})
				n.Attr[i].Val = funcName
			}
		}

		// Expresiones para h-show y h-if
		if key == "h-show" || key == "h-if" {
			if !isSignalReference(val) {
				exprCode, err := parseExpression(val, itemName)
				if err == nil {
					exprCounter++
					funcName := fmt.Sprintf("__expr_%s_%d", cc.Name, exprCounter)
					auxFunctions = append(auxFunctions, AuxFunction{
						Name: funcName,
						Args: []string{"ctx"},
						Body: fmt.Sprintf("return %s;", exprCode),
					})
					n.Attr[i].Val = funcName
				}
			}
		}
	}
}

func (cc *ComponentCompiler) isAOTDirective(key string) bool {
	switch {
	case key == "h-text", key == "h-show", key == "h-if", key == "h-each":
		return true
	case strings.HasPrefix(key, "h-style:"):
		return true
	default:
		return false
	}
}

func (cc *ComponentCompiler) isSkippedDirective(key string) bool {
	return key == "h-component" || strings.HasPrefix(key, "h-bind:")
}

func (cc *ComponentCompiler) isExpressionDirective(key string) bool {
	return key == "h-bind:class" || key == "h-class" ||
		key == "h-bind:style" || key == "h-style"
}

// ==========================================
// ---- Compilación SFC (sin cambios estructurales) ----
// ==========================================

func (cc *ComponentCompiler) CompileSFC(raw string) (string, error) {
	exprCounter = 0
	auxFunctions = nil

	reStyle := regexp.MustCompile(`(?s)<style[^>]*>(.*?)</style>`)
	reScript := regexp.MustCompile(`(?s)<script[^>]*>(.*?)</script>`)
	reTemplate := regexp.MustCompile(`(?s)<template[^>]*>(.*)</template>`)

	styleText, scriptText, templateText := "", "", ""
	if m := reStyle.FindStringSubmatch(raw); len(m) > 1 {
		styleText = strings.TrimSpace(m[1])
	}
	if m := reScript.FindStringSubmatch(raw); len(m) > 1 {
		scriptText = strings.TrimSpace(m[1])
	}
	if m := reTemplate.FindStringSubmatch(raw); len(m) > 1 {
		templateText = strings.TrimSpace(m[1])
	} else {
		return "", fmt.Errorf("no se encontró etiqueta <template>")
	}

	doc, err := html.Parse(strings.NewReader(templateText))
	if err != nil {
		return "", fmt.Errorf("error parseando HTML: %w", err)
	}

	rootElement := extractRootElement(doc)
	if rootElement == nil {
		return "", fmt.Errorf("el <template> está vacío")
	}

	NormalizeTree(rootElement)
	cc.Traverse(rootElement, []int{}, "")

	var cleanHTML bytes.Buffer
	html.Render(&cleanHTML, rootElement)

	scopedCSS := ScopeCSSAdvanced(styleText, cc.ScopeID)
	return cc.generateJS(cleanHTML.String(), scopedCSS, scriptText), nil
}

func extractRootElement(doc *html.Node) *html.Node {
	var findBody func(*html.Node)
	var root *html.Node
	findBody = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "body" {
			root = n.FirstChild
			return
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			findBody(c)
		}
	}
	findBody(doc)
	return root
}

// ==========================================
// ---- Generación de JS (modularizada) ----
// ==========================================

func (cc *ComponentCompiler) generateJS(htmlStr, cssStr, scriptStr string) string {
	var sb strings.Builder
	sb.WriteString("// GENERADO AUTOMÁTICAMENTE POR HANNAH-CORE AOT - NO MODIFICAR\n")
	sb.WriteString("import { registerSink, registerListSink, SINK_TYPE_TEXT, SINK_TYPE_SHOW, SINK_TYPE_IF, SINK_TYPE_STYLE } from '../core/reactive.js';\n")
	sb.WriteString("import { compileDirectives } from '../core/directives.js';\n\n")

	// Preparar script
	scriptStr = strings.TrimSpace(scriptStr)
	reExport := regexp.MustCompile(`(?s)export\s+default\s*\{`)
	if reExport.MatchString(scriptStr) {
		scriptStr = reExport.ReplaceAllString(scriptStr, "const _sfc_main = {")
	} else {
		scriptStr += "\nconst _sfc_main = {};\n"
	}
	sb.WriteString(scriptStr)
	sb.WriteString("\n\n")

	// Funciones auxiliares (usando window.__hannah_expr)
	if len(auxFunctions) > 0 {
		sb.WriteString("// Funciones auxiliares generadas por el compilador\n")
		sb.WriteString("if (!window.__hannah_expr) window.__hannah_expr = {};\n")
		for _, fn := range auxFunctions {
			sb.WriteString("window.__hannah_expr['" + fn.Name + "'] = function(" + strings.Join(fn.Args, ", ") + ") {\n")
			sb.WriteString("    " + fn.Body + "\n")
			sb.WriteString("};\n")
		}
		sb.WriteString("\n")
	}

	// CSS y template
	sb.WriteString("const tpl = document.createElement('template');\n")
	safeHTML := strings.ReplaceAll(strings.TrimSpace(htmlStr), "`", "\\`")
	sb.WriteString("tpl.innerHTML = `" + safeHTML + "`;\n\n")

	sb.WriteString("_sfc_main.name = '" + cc.Name + "';\n")
	if cssStr != "" {
		sb.WriteString("_sfc_main.styles = `" + strings.TrimSpace(cssStr) + "`;\n")
	}

	// Render
	sb.WriteString("_sfc_main.render = function(context, instanceId) {\n")
	sb.WriteString("    const fragment = tpl.content.cloneNode(true);\n")
	sb.WriteString("    const root = fragment.firstElementChild;\n\n")

	// Agrupar bindings
	nodeBindingsMap, eachPaths := cc.groupBindings()

	// Generar código para cada nodo
	for _, nb := range nodeBindingsMap {
		if cc.isInsideEach(nb.Path, eachPaths) {
			continue
		}
		pathNav := cc.buildPathNavigation(nb.Path)
		cc.generateNodeCode(&sb, pathNav, nb.Bindings)
	}

	sb.WriteString("\n    return fragment;\n")
	sb.WriteString("};\n\n")

	formattedName := toPascalCase(cc.Name)
	sb.WriteString("export const " + formattedName + "Component = _sfc_main;\n")

	return sb.String()
}

// 5. Agrupar bindings por nodo
type NodeBindings struct {
	Path     []int
	Bindings []Binding
}

func (cc *ComponentCompiler) groupBindings() (map[string]*NodeBindings, [][]int) {
	nodeBindingsMap := make(map[string]*NodeBindings)
	var eachPaths [][]int
	for _, b := range cc.Bindings {
		var pathBuilder strings.Builder
		pathBuilder.WriteByte('[')
		for i, idx := range b.Path {
			if i > 0 {
				pathBuilder.WriteByte(',')
			}
			pathBuilder.WriteString(strconv.Itoa(idx))
		}
		pathBuilder.WriteByte(']')
		pathKey := pathBuilder.String()
		if _, ok := nodeBindingsMap[pathKey]; !ok {
			nodeBindingsMap[pathKey] = &NodeBindings{Path: b.Path}
		}
		nodeBindingsMap[pathKey].Bindings = append(nodeBindingsMap[pathKey].Bindings, b)
		if b.Directive == "h-each" {
			eachPaths = append(eachPaths, b.Path)
		}
	}
	return nodeBindingsMap, eachPaths
}

func (cc *ComponentCompiler) isInsideEach(path []int, eachPaths [][]int) bool {
	for _, ep := range eachPaths {
		if len(path) > len(ep) {
			isDescendant := true
			for i := 0; i < len(ep); i++ {
				if path[i] != ep[i] {
					isDescendant = false
					break
				}
			}
			if isDescendant {
				return true
			}
		}
	}
	return false
}

func (cc *ComponentCompiler) buildPathNavigation(path []int) string {
	var builder strings.Builder
	builder.WriteString("root")
	for _, idx := range path {
		builder.WriteString(fmt.Sprintf(".childNodes[%d]", idx))
	}
	return builder.String()
}

func (cc *ComponentCompiler) generateNodeCode(sb *strings.Builder, pathNav string, bindings []Binding) {
	// Buscar h-each
	var eachBinding, keyBinding *Binding
	for _, b := range bindings {
		if b.Directive == "h-each" {
			eachBinding = &b
		} else if b.Directive == "h-key" {
			keyBinding = &b
		}
	}

	if eachBinding != nil {
		cc.generateEachCode(sb, pathNav, eachBinding, keyBinding)
		return
	}

	// Generar sinks para otras directivas
	sb.WriteString("    {\n")
	sb.WriteString("        const targetEl = " + pathNav + ";\n")
	for i, b := range bindings {
		if b.Directive == "h-key" {
			continue
		}
		sinkType, metaStr := cc.getSinkTypeAndMeta(b, i)
		sb.WriteString("        if (context." + b.Value + " !== undefined) {\n")
		if metaStr == "null" {
			sb.WriteString("            registerSink(targetEl, " + sinkType + ", context." + b.Value + ", instanceId);\n")
		} else {
			sb.WriteString("            registerSink(targetEl, " + sinkType + ", context." + b.Value + ", instanceId, " + metaStr + ");\n")
		}
		sb.WriteString("        }\n")
	}
	sb.WriteString("    }\n")
}

func (cc *ComponentCompiler) generateEachCode(sb *strings.Builder, pathNav string, eachBinding, keyBinding *Binding) {
	reEach := regexp.MustCompile(`^\s*(\w+)\s+in\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*$`)
	matches := reEach.FindStringSubmatch(eachBinding.Value)
	if len(matches) != 3 {
		return
	}
	itemName := matches[1]
	arrayName := matches[2]
	// Si no tiene "context.", lo agregamos
	if !strings.HasPrefix(arrayName, "context.") {
		arrayName = "context." + arrayName
	}
	keyProp := "id"
	if keyBinding != nil {
		keyProp = keyBinding.Value
	}
	sb.WriteString("    if (" + arrayName + " !== undefined) {\n")
	sb.WriteString("        registerListSink(" + pathNav + ", " + arrayName + ", '" + keyProp + "', '" + itemName + "', instanceId, compileDirectives);\n")
	sb.WriteString("    }\n")
}

func (cc *ComponentCompiler) getSinkTypeAndMeta(b Binding, index int) (string, string) {
	sinkType := "SINK_TYPE_TEXT"
	metaStr := "null"
	switch b.Directive {
	case "h-show":
		sinkType = "SINK_TYPE_SHOW"
	case "h-if":
		sinkType = "SINK_TYPE_IF"
		// Necesitamos generar un anchor comentario
		metaStr = fmt.Sprintf("anchor_%d", index)
	case "h-style:":
		sinkType = "SINK_TYPE_STYLE"
		cssVar := strings.TrimPrefix(b.Directive, "h-style:")
		metaStr = fmt.Sprintf("{ cssVar: '%s' }", cssVar)
	default:
		// h-text
	}
	return sinkType, metaStr
}

// ==========================================
// ---- Servidor y HMR (sin cambios) ----
// ==========================================
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true }, // Permitir conexiones locales
}

var clients = make(map[*websocket.Conn]bool)
var broadcast = make(chan string)

func handleHMRConnections(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Error al actualizar a WebSocket:", err)
		return
	}
	defer conn.Close()

	clients[conn] = true
	fmt.Println("🔌 Cliente HMR conectado")

	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			delete(clients, conn)
			fmt.Println("🔌 Cliente HMR desconectado")
			break
		}
	}
}

func hmrBroadcaster() {
	for {
		msg := <-broadcast
		for client := range clients {
			err := client.WriteMessage(websocket.TextMessage, []byte(msg))
			if err != nil {
				client.Close()
				delete(clients, client)
			}
		}
	}
}

func compileAndBroadcast(filePath string) {
	// CORRECCIÓN 2: Pausa anti-guardado-atómico.
	// Esperamos 50ms para asegurar que el editor terminó de escribir el archivo en disco.
	time.Sleep(50 * time.Millisecond)

	fmt.Printf("🔄 Cambio detectado: %s\n", filePath)

	content, err := os.ReadFile(filePath)
	if err != nil || len(strings.TrimSpace(string(content))) == 0 {
		// fmt.Printf("❌ Error leyendo archivo: %v\n", err)
		fmt.Println("⚠️ Archivo vacío o no disponible, ignorando...")
		return
	}

	// Doble seguridad: si el archivo sigue vacío por alguna razón, lo ignoramos
	if len(strings.TrimSpace(string(content))) == 0 {
		fmt.Println("⚠️ Archivo vacío detectado, ignorando evento de guardado...")
		return
	}

	name := strings.TrimSuffix(filepath.Base(filePath), ".html")
	scopeId := fmt.Sprintf("data-h-%s", name)
	compiler := &ComponentCompiler{Name: name, ScopeID: scopeId}

	jsCode, err := compiler.CompileSFC(string(content))
	if err != nil {
		fmt.Printf("❌ Error compilando %s: %v\n", name, err)
		return
	}

	outPath := fmt.Sprintf("src/components/%s.js", name)
	err = os.WriteFile(outPath, []byte(jsCode), 0644)
	if err != nil {
		fmt.Printf("❌ Error escribiendo %s: %v\n", outPath, err)
		return
	}

	fmt.Printf("✅ Recompilado AOT: %s\n", filepath.Base(outPath))

	// CORRECCIÓN 3: La ruta del módulo debe coincidir con el servidor de archivos.
	// Como el servidor ahora apunta a ".", la ruta real es /src/components/...
	hmrPayload := fmt.Sprintf(`{"type": "update", "path": "/src/components/%s.js", "timestamp": %d}`, name, time.Now().UnixMilli())
	broadcast <- hmrPayload
}

var lastEventTime = time.Time{} // Para el debounce

func startDevServer() {
	fmt.Println("🚀 Iniciando Hannah Dev Server en http://localhost:3000")

	fs := http.FileServer(http.Dir("."))

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// CABECERAS ANTI-CACHÉ: Vital para que el HMR funcione con módulos ES6
		if strings.HasSuffix(r.URL.Path, ".js") || strings.HasSuffix(r.URL.Path, ".html") {
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
			w.Header().Set("Pragma", "no-cache")
			w.Header().Set("Expires", "1")
		}

		if r.URL.Path == "/" || r.URL.Path == "/index.html" {
			content, err := os.ReadFile("./index.html")
			if err == nil {
				htmlStr := string(content)
				hmrScript := `<script type="module" src="/src/core/hmr.js"></script>`

				// INYECCIÓN DINÁMICA: Solo si no está ya inyectado
				if !strings.Contains(htmlStr, "hmr.js") {
					if strings.Contains(htmlStr, "</body>") {
						htmlStr = strings.Replace(htmlStr, "</body>", hmrScript+"\n</body>", 1)
					} else if strings.Contains(htmlStr, "</head>") {
						htmlStr = strings.Replace(htmlStr, "</head>", hmrScript+"\n</head>", 1)
					} else {
						htmlStr += "\n" + hmrScript
					}
				}

				w.Header().Set("Content-Type", "text/html; charset=utf-8")
				w.Write([]byte(htmlStr))
				return
			}
		}
		fs.ServeHTTP(w, r)
	})

	http.HandleFunc("/hmr", handleHMRConnections)
	go hmrBroadcaster()

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		log.Fatal(err)
	}
	defer watcher.Close()

	err = watcher.Add("src/components")
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("👀 Vigilando cambios en: src/components/")

	go func() {
		var lastEventTime = time.Time{}
		var debounceDelay = 150 * time.Millisecond

		for {
			select {
			case event, ok := <-watcher.Events:
				if !ok {
					return
				}
				// if event.Has(fsnotify.Write) || event.Has(fsnotify.Create) {
				// 	if strings.HasSuffix(event.Name, ".html") {
				// 		// DEBOUNCE: Evita la doble compilación si el editor guarda en dos fases
				// 		if time.Since(lastEventTime) > 150*time.Millisecond {
				// 			lastEventTime = time.Now()
				// 			compileAndBroadcast(event.Name)
				// 		}
				// 	}
				// }
				if strings.HasSuffix(event.Name, ".html") {
					if time.Since(lastEventTime) > debounceDelay {
						lastEventTime = time.Now()
						// Leer el archivo con un pequeño retraso adicional
						time.Sleep(50 * time.Millisecond)
						compileAndBroadcast(event.Name)
					}
				}
			case err, ok := <-watcher.Errors:
				if !ok {
					return
				}
				log.Println("Error en watcher:", err)
			}
		}
	}()

	log.Fatal(http.ListenAndServe(":3000", nil))
}

func runProductionBuild() {
	fmt.Println("🚀 Iniciando Hannah CLI (Modo Build)...")

	// 1. Compilar todos los SFCs
	sfcFiles, _ := filepath.Glob("src/components/*.html")
	for _, file := range sfcFiles {
		content, _ := os.ReadFile(file)
		name := strings.TrimSuffix(filepath.Base(file), ".html")
		compiler := &ComponentCompiler{Name: name, ScopeID: fmt.Sprintf("data-h-%s", name)}
		jsCode, err := compiler.CompileSFC(string(content))
		if err != nil {
			fmt.Printf("❌ Error compilando %s: %v\n", name, err)
			continue
		}
		outPath := fmt.Sprintf("src/components/%s.js", name)
		os.WriteFile(outPath, []byte(jsCode), 0644)
		fmt.Printf("✓ Compilado AOT: %s -> %s\n", file, outPath)
	}

	fmt.Println("\n📦 Empaquetando aplicación con esbuild...")
	os.RemoveAll("dist")
	os.MkdirAll("dist", os.ModePerm)

	// 2. BUNDLE ÚNICO (Sin code splitting para evitar problemas de referencias)
	result := api.Build(api.BuildOptions{
		EntryPoints: []string{"src/main.js"},
		Outfile:     "dist/bundle.js",
		Bundle:      true,
		Write:       true,
		// Splitting:         false,  // DESHABILITADO temporalmente
		Format:            api.FormatESModule,
		Target:            api.ES2020,
		MinifyWhitespace:  true,
		MinifyIdentifiers: false, // Evitar minificación de identificadores
		MinifySyntax:      true,
		LogLevel:          api.LogLevelWarning,
	})

	if len(result.Errors) > 0 {
		fmt.Println("❌ Errores críticos en esbuild:")
		for _, err := range result.Errors {
			fmt.Printf("  - %s\n", err.Text)
		}
		os.Exit(1)
	}

	info, _ := os.Stat("dist/bundle.js")
	fmt.Printf("✅ Build completado exitosamente: dist/bundle.js (%.2f KB)\n", float64(info.Size())/1024)
}

func main() {
	if len(os.Args) > 1 && os.Args[1] == "dev" {
		startDevServer()
	} else {
		runProductionBuild()
	}
}

// ==========================================
// ---- Parseo de expresiones (corregido) ----
// ==========================================
func parseExpression(expr string, itemName string) (string, error) {
	// Envolver la expresión entre paréntesis para que sea un programa válido
	src := "(" + expr + ")"
	program, err := parser.ParseFile(nil, "", src, 0)
	if err != nil {
		return "", err
	}

	// Extraer la expresión del programa (el primer statement es una ExpressionStatement)
	var result strings.Builder
	if len(program.Body) > 0 {
		if stmt, ok := program.Body[0].(*ast.ExpressionStatement); ok {
			walkNode(stmt.Expression, &result)
		} else {
			return "", fmt.Errorf("la expresión no es una ExpressionStatement")
		}
	} else {
		return "", fmt.Errorf("no se pudo parsear la expresión")
	}

	return result.String(), nil
}

// walkNode genera código que accede a las propiedades a través de ctx
func walkNode(node ast.Node, out *strings.Builder) {
	switch n := node.(type) {
	case *ast.ObjectLiteral:
		out.WriteString("{")
		for i, prop := range n.Value {
			if i > 0 {
				out.WriteString(",")
			}
			out.WriteString(prop.Key)
			out.WriteString(":")
			walkNode(prop.Value, out)
		}
		out.WriteString("}")

	case *ast.BinaryExpression:
		out.WriteString("(")
		walkNode(n.Left, out)
		out.WriteString(" " + n.Operator.String() + " ")
		walkNode(n.Right, out)
		out.WriteString(")")

	case *ast.Identifier:
		// Siempre acceder a través de ctx
		out.WriteString("ctx." + n.Name)

	case *ast.DotExpression:
		// Siempre acceder a través de ctx
		if ident, ok := n.Left.(*ast.Identifier); ok {
			out.WriteString("ctx." + ident.Name + "." + n.Identifier.Name)
		} else {
			walkNode(n.Left, out)
			out.WriteString("." + n.Identifier.Name)
		}

	case *ast.BracketExpression:
		walkNode(n.Left, out)
		out.WriteString("[")
		walkNode(n.Member, out)
		out.WriteString("]")

	case *ast.StringLiteral:
		out.WriteString(n.Literal)

	case *ast.NumberLiteral:
		out.WriteString(n.Literal)

	case *ast.BooleanLiteral:
		out.WriteString(n.Literal)

	case *ast.NullLiteral:
		out.WriteString("null")

	case *ast.UnaryExpression:
		out.WriteString(n.Operator.String())
		walkNode(n.Operand, out)

	case *ast.ConditionalExpression:
		walkNode(n.Test, out)
		out.WriteString("?")
		walkNode(n.Consequent, out)
		out.WriteString(":")
		walkNode(n.Alternate, out)

	case *ast.ArrayLiteral:
		out.WriteString("[")
		for i, elem := range n.Value {
			if i > 0 {
				out.WriteString(",")
			}
			walkNode(elem, out)
		}
		out.WriteString("]")

	default:
		// fallback: imprimir el nodo tal cual
		out.WriteString("/* unsupported node */")
	}
}
