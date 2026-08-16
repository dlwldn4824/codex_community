const cytoscapeGraphStyle = document.createElement("style");
cytoscapeGraphStyle.textContent = `.service-flow-graph{width:100%;height:570px;padding:0;overflow:hidden;border:1px solid #b5c8e4;border-radius:14px;background:#f9fcff}.service-flow-graph .flow-legend{position:absolute;z-index:2;margin:13px 16px;color:#36557f;font-size:11px;pointer-events:none}.service-flow-graph .flow-legend b{color:#df3c49}.service-flow-canvas{width:100%;height:100%}@media(max-width:720px){.service-flow-graph{height:460px}}`;
document.head.append(cytoscapeGraphStyle);

const cytoscapeResult = showResult;
showResult = function(data) {
  cytoscapeResult(data);
  if (!data.projectAnalysis?.userSecurityMap || typeof cytoscape !== "function") return;
  const graph = data.projectAnalysis.userSecurityMap, map = document.querySelector("#result-kg"), detail = document.querySelector("#graph-detail");
  const sectionHeadings = document.querySelectorAll(".result-section-head span");
  if (sectionHeadings[1]) sectionHeadings[1].textContent = "확인된 위험";
  if (sectionHeadings[2]) sectionHeadings[2].textContent = "재검증 결과";
  if (sectionHeadings[3]) sectionHeadings[3].textContent = "판정 근거";
  const text = value => String(value || "").replace(/[&<>\"']/g, character => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[character]));
  const edgeIds = new Set(graph.edges.flatMap(edge => [edge.source, edge.target]));
  const nodes = graph.nodes.filter(node => edgeIds.has(node.id)).slice(0, 24);
  const nodeIds = new Set(nodes.map(node => node.id));
  const edges = graph.edges.filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target)).slice(0, 36);
  const elements = [
    ...nodes.map(node => ({ data: { id: node.id, label: node.label, description: node.description, confidence: node.confidence, sourceFiles: node.sourceFiles || [] } })),
    ...edges.map(edge => ({ data: { id: edge.id, source: edge.source, target: edge.target, label: edge.displayLabel, risk: edge.securityStatus === "WARNING" || edge.securityStatus === "CRITICAL", explanation: edge.explanation, dataFields: edge.data || [], sourceFiles: edge.sourceFiles || [], technicalDetails: edge.technicalDetails || null } }))
  ];
  map.className = "service-flow-graph";
  map.innerHTML = `<p class="flow-legend">기능과 데이터가 이동하는 길입니다. <b>빨간 선</b>을 누르면 구체적인 보안 확인 내용을 볼 수 있습니다.</p><div class="service-flow-canvas"></div>`;
  const cy = cytoscape({ container: map.querySelector(".service-flow-canvas"), elements, layout: { name: "cose", animate: false, padding: 72, nodeRepulsion: 7500, idealEdgeLength: 135, gravity: 0.28 }, style: [
    { selector: "node", style: { "background-color": "#ffffff", "border-width": 2, "border-color": "#52739f", "label": "data(label)", "color": "#0b1830", "font-family": "HiKR, sans-serif", "font-size": 13, "font-weight": 700, "text-wrap": "wrap", "text-max-width": 100, "text-valign": "center", "text-halign": "center", "width": 108, "height": 58, "shape": "round-rectangle" } },
    { selector: "edge", style: { "width": 1.4, "line-color": "#7189aa", "target-arrow-color": "#7189aa", "target-arrow-shape": "triangle", "curve-style": "bezier", "label": "data(label)", "color": "#456184", "font-family": "HiKR, sans-serif", "font-size": 10, "text-rotation": "autorotate", "text-background-color": "#f9fcff", "text-background-opacity": 1, "text-background-padding": 3 } },
    { selector: "edge[risk = true]", style: { "width": 2.2, "line-color": "#e44550", "target-arrow-color": "#e44550", "color": "#ca2634", "font-weight": 700 } },
    { selector: ":selected", style: { "border-color": "#1558f5", "border-width": 3, "line-color": "#1558f5", "target-arrow-color": "#1558f5" } }
  ] });
  cy.on("tap", "node", event => { const node = event.target.data(); detail.innerHTML = `<b>${text(node.label)}</b><br/>${text(node.description)}<br/><small>관련 코드: ${text(node.sourceFiles.join(", ") || "확인된 파일 없음")} · ${text(node.confidence)}</small>`; });
  cy.on("tap", "edge", event => { const edge = event.target.data(), technical = edge.technicalDetails; detail.innerHTML = `<b>${text(edge.label)}</b><br/>${text(edge.explanation || "코드에서 확인된 기능 간 흐름입니다.")}<br/><small>전달 데이터: ${text(edge.dataFields.join(" · ") || "추가 확인 필요")}<br/>관련 코드: ${text(edge.sourceFiles.join(", ") || "상세 코드 확인 필요")}${technical ? `<br/>근거: ${text(`${technical.file}:${technical.line} · ${technical.rule}`)}` : ""}</small>`; });
};
