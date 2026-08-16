const cytoscapeGraphStyle = document.createElement("style");
cytoscapeGraphStyle.textContent = `.service-flow-graph{position:relative;width:100%;height:790px;padding:0;overflow:hidden;border:1px solid #b5c8e4;border-radius:14px;background:#f9fcff}.service-flow-graph .flow-legend{position:absolute;z-index:2;left:0;top:0;margin:15px 18px;color:#264b7d;font-size:13px;font-weight:700;pointer-events:none}.service-flow-graph .flow-legend b{color:#d93646}.flow-controls{position:absolute;z-index:3;right:14px;top:12px;display:flex;gap:6px}.flow-controls button{display:grid;place-items:center;width:36px;height:36px;border:1px solid #7697c4;border-radius:9px;background:#fff;color:#123a75;font:700 22px Arial;cursor:pointer}.flow-controls button:hover{background:#e8f1ff}.service-flow-canvas{width:100%;height:100%}@media(max-width:720px){.service-flow-graph{height:610px}.flow-controls{right:8px}}`;
document.head.append(cytoscapeGraphStyle);

const cytoscapeResult = showResult;
showResult = function(data) {
  cytoscapeResult(data);
  if (!data.projectAnalysis?.userSecurityMap || typeof cytoscape !== "function") return;
  const graph = data.projectAnalysis.userSecurityMap, map = document.querySelector("#result-kg"), detail = document.querySelector("#graph-detail");
  const headings = document.querySelectorAll(".result-section-head span");
  if (headings[1]) headings[1].textContent = "확인된 위험";
  if (headings[2]) headings[2].closest(".replay-block").hidden = true;
  if (headings[3]) headings[3].closest(".why-block").hidden = true;
  if (headings[4]) headings[4].closest(".build-log-block").hidden = true;
  const escape = value => String(value || "").replace(/[&<>"']/g, character => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[character]));
  const riskEdges = graph.edges.filter(edge => edge.securityStatus === "WARNING" || edge.securityStatus === "CRITICAL");
  const priority = new Set(riskEdges.flatMap(edge => [edge.source, edge.target]));
  graph.edges.forEach(edge => { if (priority.has(edge.source) || priority.has(edge.target)) { priority.add(edge.source); priority.add(edge.target); } });
  // 화면에는 실제 흐름에 연결된 기능만 남깁니다. 연결 근거가 없는 파일은
  // 상세 분석에서 보되, 서비스 지도에서는 고립된 점으로 노출하지 않습니다.
  const seenEdges = new Set();
  const edges = graph.edges.filter(edge => edge.source !== edge.target).filter(edge => { const key = `${edge.source}:${edge.target}:${edge.displayLabel}`; if (seenEdges.has(key)) return false; seenEdges.add(key); return true; });
  const connectedIds = new Set(edges.flatMap(edge => [edge.source, edge.target]));
  const ordered = [...graph.nodes.filter(node => priority.has(node.id)), ...graph.nodes.filter(node => !priority.has(node.id))];
  const nodes = ordered.filter(node => connectedIds.has(node.id));
  const elements = [
    ...nodes.map(node => ({ data: { id: node.id, label: node.label, description: node.description, confidence: node.confidence, sourceFiles: node.sourceFiles || [] } })),
    ...edges.map((edge, index) => ({ data: { id: edge.id, source: edge.source, target: edge.target, label: edge.displayLabel, labelOffset: ((index % 5) - 2) * 18, risk: edge.securityStatus === "WARNING" || edge.securityStatus === "CRITICAL", explanation: edge.explanation, dataFields: edge.data || [], sourceFiles: edge.sourceFiles || [], technicalDetails: edge.technicalDetails || null } }))
  ];
  map.className = "service-flow-graph";
  map.innerHTML = `<p class="flow-legend">기능과 데이터가 이동하는 길입니다. <b>빨간 선</b>은 실제 코드 근거가 있어 점검이 필요한 흐름입니다.</p><div class="flow-controls"><button type="button" data-zoom="out" aria-label="축소">−</button><button type="button" data-zoom="in" aria-label="확대">+</button><button type="button" data-zoom="fit" aria-label="전체 보기">□</button></div><div class="service-flow-canvas"></div>`;
  const cy = cytoscape({ container: map.querySelector(".service-flow-canvas"), elements, wheelSensitivity: 0, userZoomingEnabled: false, userPanningEnabled: true, autoungrabify: true, boxSelectionEnabled: false, layout: { name: "breadthfirst", directed: true, spacingFactor: 2.35, padding: 145, animate: false, avoidOverlap: true, nodeDimensionsIncludeLabels: true }, style: [
    { selector: "node", style: { "background-color": "#ffffff", "border-width": 2.5, "border-color": "#52739f", "label": "data(label)", "color": "#0b1830", "font-family": "HiKR, sans-serif", "font-size": 16, "font-weight": 700, "text-wrap": "wrap", "text-max-width": 120, "text-valign": "center", "text-halign": "center", "width": 126, "height": 126, "shape": "ellipse" } },
    { selector: "edge", style: { "width": 1.6, "line-color": "#7189aa", "target-arrow-color": "#7189aa", "target-arrow-shape": "triangle", "curve-style": "bezier", "control-point-step-size": 60, "label": "data(label)", "color": "#244a7d", "font-family": "HiKR, sans-serif", "font-size": 12, "font-weight": 700, "text-rotation": "none", "text-margin-y": "data(labelOffset)", "text-background-color": "#f9fcff", "text-background-opacity": 1, "text-background-padding": 5 } },
    { selector: "edge[risk = true]", style: { "width": 2.1, "line-color": "#e44550", "target-arrow-color": "#e44550", "color": "#c92f3c" } },
    { selector: ":selected", style: { "border-color": "#1558f5", "border-width": 3, "line-color": "#1558f5", "target-arrow-color": "#1558f5" } }
  ] });
  cy.userZoomingEnabled(false);
  cy.nodes().lock();
  const zoomAtCenter = multiplier => { const next = Math.max(0.45, Math.min(2.2, cy.zoom() * multiplier)); cy.zoom({ level: next, renderedPosition: { x: map.clientWidth / 2, y: map.clientHeight / 2 } }); };
  map.querySelector('[data-zoom="in"]').addEventListener("click", () => zoomAtCenter(1.18));
  map.querySelector('[data-zoom="out"]').addEventListener("click", () => zoomAtCenter(0.84));
  map.querySelector('[data-zoom="fit"]').addEventListener("click", () => cy.fit(cy.elements(), 105));
  cy.on("tap", "node", event => { const node = event.target.data(); detail.innerHTML = `<b>${escape(node.label)}</b><br/>${escape(node.description)}<br/><small>관련 코드: ${escape(node.sourceFiles.join(", ") || "확인된 파일 없음")}</small>`; });
  cy.on("tap", "edge", event => { const edge = event.target.data(), technical = edge.technicalDetails; detail.innerHTML = `<b>${escape(edge.label)}</b><br/>${escape(edge.explanation || "코드에서 확인된 기능 간 흐름입니다.")}<br/><small>전달될 수 있는 데이터: ${escape(edge.dataFields.join(" · ") || "코드에서 특정 데이터 항목을 확정하지 못함")}<br/>관련 코드: ${escape(edge.sourceFiles.join(", ") || "상세 코드 확인 필요")}${technical ? `<br/>근거 위치: ${escape(`${technical.file}:${technical.line}`)}` : ""}</small>`; });
};
