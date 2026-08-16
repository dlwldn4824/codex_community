const cytoscapeGraphStyle = document.createElement("style");
cytoscapeGraphStyle.textContent = `.service-flow-graph{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 340px;width:100%;height:790px;padding:0;overflow:hidden;border:1px solid #b5c8e4;border-radius:14px;background:#f9fcff}.service-flow-graph .flow-legend{position:absolute;z-index:2;left:0;top:0;margin:15px 18px;color:#264b7d;font-size:13px;font-weight:700;pointer-events:none}.service-flow-graph .flow-legend b{color:#d93646}.flow-controls{position:absolute;z-index:4;right:14px;top:12px;display:flex;gap:6px}.flow-controls button{display:grid;place-items:center;width:36px;height:36px;border:1px solid #7697c4;border-radius:9px;background:#fff;color:#123a75;font:700 22px Arial;cursor:pointer}.flow-controls button[data-filter-risks]{width:auto;padding:0 12px;border-color:#df7880;color:#c92f3c;font:700 12px 'HiKR',sans-serif}.flow-controls button[data-filter-risks].active{background:#c92f3c;color:#fff}.flow-controls button:hover{background:#e8f1ff}.flow-controls button[data-filter-risks]:hover{background:#fff0f1}.service-flow-canvas{grid-column:1;grid-row:1;width:100%;height:100%}.graph-side-panel{grid-column:2;grid-row:1;z-index:3;align-self:start;min-height:230px;margin:62px 16px 16px 0;padding:18px;border:1px solid #91abd0;border-radius:12px;background:#fffffff2;box-shadow:0 12px 28px #3d5e8520;color:#0b1830}.graph-side-panel .panel-label{display:block;margin-bottom:9px;color:#1558f5;font-size:11px}.graph-side-panel.risk .panel-label{color:#c92f3c}.graph-side-panel h3{margin:0 0 9px;font-size:18px;line-height:1.35}.graph-side-panel p{margin:0;color:#405a78;font-size:13px;line-height:1.65}.graph-side-panel small{display:block;margin-top:12px;padding-top:10px;border-top:1px solid #d9e4f3;color:#536a89;font-size:11px;line-height:1.6}.service-flow-graph + .graph-detail{display:none}@media(max-width:960px){.service-flow-graph{grid-template-columns:minmax(0,1fr) 285px}.graph-side-panel{margin-right:12px}}@media(max-width:720px){.service-flow-graph{display:block;height:auto;padding-top:0}.service-flow-canvas{height:610px}.flow-controls{right:8px}.graph-side-panel{margin:0 10px 10px;min-height:120px}.service-flow-graph .flow-legend{font-size:10px;max-width:67%}.flow-controls button[data-filter-risks]{font-size:10px;padding:0 8px}}`;
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
    ...edges.map((edge, index) => ({
      group: "edges",
      classes: edge.securityStatus === "WARNING" || edge.securityStatus === "CRITICAL" ? "risk-edge" : "safe-edge",
      data: { id: edge.id, source: edge.source, target: edge.target, label: edge.displayLabel, labelOffset: ((index % 5) - 2) * 18, risk: edge.securityStatus === "WARNING" || edge.securityStatus === "CRITICAL", explanation: edge.explanation, dataFields: edge.data || [], sourceFiles: edge.sourceFiles || [], technicalDetails: edge.technicalDetails || null }
    }))
  ];
  map.className = "service-flow-graph";
  map.innerHTML = `<p class="flow-legend">기능과 데이터가 이동하는 길입니다. <b>빨간 선</b>은 실제 코드 근거가 있어 점검이 필요한 흐름입니다.</p><div class="flow-controls"><button type="button" data-filter-risks aria-pressed="false">위험 흐름만 보기</button><button type="button" data-zoom="out" aria-label="축소">−</button><button type="button" data-zoom="in" aria-label="확대">+</button><button type="button" data-zoom="fit" aria-label="전체 보기">□</button></div><aside class="graph-side-panel"><span class="panel-label">보안 확인 근거</span><h3>빨간 선을 선택하세요.</h3><p>이곳에서 어떤 데이터가 이동하고, 왜 보안 확인이 필요한지 바로 보여줍니다.</p></aside><div class="service-flow-canvas"></div>`;
  const sidePanel = map.querySelector(".graph-side-panel");
  const canvas = map.querySelector(".service-flow-canvas");
  const cy = cytoscape({ container: canvas, elements, minZoom: 0.08, maxZoom: 3, wheelSensitivity: 0, userZoomingEnabled: false, userPanningEnabled: true, autoungrabify: true, boxSelectionEnabled: false, layout: { name: "breadthfirst", directed: true, spacingFactor: 2.35, padding: 145, animate: false, avoidOverlap: true, nodeDimensionsIncludeLabels: true }, style: [
    { selector: "node", style: { "background-color": "#ffffff", "border-width": 2.5, "border-color": "#52739f", "label": "data(label)", "color": "#0b1830", "font-family": "HiKR, sans-serif", "font-size": 16, "font-weight": 700, "text-wrap": "wrap", "text-max-width": 120, "text-valign": "center", "text-halign": "center", "width": 126, "height": 126, "shape": "ellipse" } },
    { selector: "edge", style: { "width": 1.6, "target-arrow-shape": "triangle", "curve-style": "bezier", "control-point-step-size": 60, "label": "data(label)", "font-family": "HiKR, sans-serif", "font-size": 12, "font-weight": 700, "text-rotation": "none", "text-margin-y": "data(labelOffset)", "text-background-color": "#f9fcff", "text-background-opacity": 1, "text-background-padding": 5 } },
    { selector: "edge.safe-edge", style: { "line-color": "#101820", "target-arrow-color": "#101820", "color": "#101820" } },
    { selector: "edge.risk-edge", style: { "width": 2.1, "line-color": "#e44550", "target-arrow-color": "#e44550", "color": "#c92f3c" } },
    { selector: ":selected", style: { "border-color": "#1558f5", "border-width": 3, "line-color": "#1558f5", "target-arrow-color": "#1558f5" } }
  ] });
  cy.userZoomingEnabled(false);
  cy.nodes().lock();
  // fit() 직후의 배율은 큰 저장소에서 0.45보다 작을 수 있습니다.
  // 이전 하한값 때문에 −를 눌러도 오히려 확대되거나 변화가 없었습니다.
  const zoomAtCenter = multiplier => {
    const next = Math.max(0.08, Math.min(3, cy.zoom() * multiplier));
    cy.zoom({ level: next, renderedPosition: { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 } });
  };
  map.querySelector('[data-zoom="in"]').addEventListener("click", event => { event.preventDefault(); zoomAtCenter(1.2); });
  map.querySelector('[data-zoom="out"]').addEventListener("click", event => { event.preventDefault(); zoomAtCenter(0.75); });
  map.querySelector('[data-zoom="fit"]').addEventListener("click", () => cy.fit(cy.elements(), 105));
  const riskFilter = map.querySelector("[data-filter-risks]");
  const layoutOptions = { name: "breadthfirst", directed: true, spacingFactor: 2.35, padding: 110, animate: false, avoidOverlap: true, nodeDimensionsIncludeLabels: true };
  riskFilter.addEventListener("click", () => {
    const enabled = riskFilter.getAttribute("aria-pressed") !== "true";
    riskFilter.setAttribute("aria-pressed", String(enabled)); riskFilter.classList.toggle("active", enabled);
    riskFilter.textContent = enabled ? "전체 흐름 보기" : "위험 흐름만 보기";
    const focus = cy.$("edge.risk-edge").union(cy.$("edge.risk-edge").connectedNodes());
    if (enabled) { cy.elements().hide(); focus.show(); } else cy.elements().show();
    const visible = enabled ? focus : cy.elements();
    cy.nodes().unlock(); visible.layout(layoutOptions).run(); cy.nodes().lock(); cy.fit(visible, 82);
  });
  cy.on("tap", "node", event => { const node = event.target.data(); sidePanel.classList.remove("risk"); sidePanel.innerHTML = `<span class="panel-label">기능 정보</span><h3>${escape(node.label)}</h3><p>${escape(node.description)}</p><small>관련 코드: ${escape(node.sourceFiles.join(", ") || "확인된 파일 없음")}</small>`; });
  cy.on("tap", "edge", event => { const edge = event.target.data(), technical = edge.technicalDetails, isRisk = edge.risk; sidePanel.classList.toggle("risk", isRisk); sidePanel.innerHTML = `<span class="panel-label">${isRisk ? "확인된 보안 위험" : "기능 연결 정보"}</span><h3>${escape(edge.label)}</h3><p>${escape(edge.explanation || "코드에서 확인된 기능 간 흐름입니다.")}</p><small>전달될 수 있는 데이터: ${escape(edge.dataFields.join(" · ") || "코드에서 특정 데이터 항목을 확정하지 못함")}<br/>관련 코드: ${escape(edge.sourceFiles.join(", ") || "상세 코드 확인 필요")}${technical ? `<br/>근거 위치: ${escape(`${technical.file}:${technical.line}`)}` : ""}</small>`; });
};
