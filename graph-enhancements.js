// Add these functions before the closing })(); in dashboard.html

// Helper: Show node context panel
function showNodeContext(selectedNode, allNodes, allLinks) {
    const panel = document.getElementById('graph-context');
    const title = document.getElementById('context-title');
    const content = document.getElementById('context-content');

    title.textContent = selectedNode.label;

    // Find connections
    const callers = allLinks.filter(l => l.target.id === selectedNode.id && l.type === 'CALLS');
    const callees = allLinks.filter(l => l.source.id === selectedNode.id && l.type === 'CALLS');
    const imports = allLinks.filter(l => l.source.id === selectedNode.id && l.type === 'IMPORTS');

    let html = `<p><strong>Type:</strong> ${selectedNode.type}</p>`;
    html += `<p><strong>Risk:</strong> <span class="tag-${selectedNode.risk.toLowerCase()}">${selectedNode.risk}</span></p>`;
    html += `<p><strong>Centrality:</strong> ${selectedNode.centrality || 0}</p>`;

    html += `<hr style="border-color: var(--vscode-panel-border);">`;

    html += `<h4>💥 What breaks if I change this?</h4>`;
    if (callers.length > 0) {
        html += `<p><strong>${callers.length} function(s)</strong> call this:</p><ul>`;
        callers.slice(0, 5).forEach(l => {
            const caller = allNodes.find(n => n.id === l.source.id);
            if (caller) html += `<li>${caller.label}</li>`;
        });
        if (callers.length > 5) html += `<li>... and ${callers.length - 5} more</li>`;
        html += `</ul>`;
    } else {
        html += `<p style="color: var(--vscode-descriptionForeground);">Nothing directly calls this. Safe to modify!</p>`;
    }

    if (callees.length > 0) {
        html += `<h4>📞 This calls:</h4><ul>`;
        callees.slice(0, 5).forEach(l => {
            const callee = allNodes.find(n => n.id === l.target.id);
            if (callee) html += `<li>${callee.label}</li>`;
        });
        if (callees.length > 5) html += `<li>... and ${callees.length - 5} more</li>`;
        html += `</ul>`;
    }

    if (imports.length > 0) {
        html += `<h4>📦 Imports:</h4><ul>`;
        imports.slice(0, 3).forEach(l => {
            const imp = allNodes.find(n => n.id === l.target.id);
            if (imp) html += `<li>${imp.label}</li>`;
        });
        if (imports.length > 3) html += `<li>... and ${imports.length - 3} more</li>`;
        html += `</ul>`;
    }

    content.innerHTML = html;
    panel.style.display = 'block';
}

// Helper: Highlight connected nodes
function highlightConnections(selectedNode, allNodes, allLinks, nodeSelection, linkSelection) {
    const connectedIds = new Set([selectedNode.id]);
    const connectedLinkIds = new Set();

    // Find all connected nodes
    allLinks.forEach(l => {
        if (l.source.id === selectedNode.id || l.target.id === selectedNode.id) {
            connectedIds.add(l.source.id);
            connectedIds.add(l.target.id);
            connectedLinkIds.add(`${l.source.id}-${l.target.id}`);
        }
    });

    // Highlight/dim nodes
    nodeSelection.classed('highlighted', d => d.id === selectedNode.id);
    nodeSelection.classed('dimmed', d => !connectedIds.has(d.id));

    // Highlight/dim links
    linkSelection.classed('highlighted', d => connectedLinkIds.has(`${d.source.id}-${d.target.id}`));
    linkSelection.classed('dimmed', d => !connectedLinkIds.has(`${d.source.id}-${d.target.id}`));
}

// Clear selection button
document.getElementById('clearSelection')?.addEventListener('click', () => {
    document.querySelectorAll('.node').forEach(n => {
        n.classList.remove('highlighted', 'dimmed');
    });
    document.querySelectorAll('.link').forEach(l => {
        l.classList.remove('highlighted', 'dimmed');
    });
    document.getElementById('graph-context').style.display = 'none';
});

// ALSO UPDATE THE NODE CLICK HANDLER (around line 732):
// Replace:
//     .on('click', (event, d) => {
//         const tooltip = document.getElementById('graph-tooltip');
//         tooltip.innerHTML = `<strong>${d.label}</strong><br>Type: ${d.type}<br>Risk: ${d.risk || 'N/A'}<br>Centrality: ${d.centrality || 0}`;
//         tooltip.style.display = 'block';
//         tooltip.style.left = event.pageX + 10 + 'px';
//         tooltip.style.top = event.pageY + 10 + 'px';
//     })
//
// With:
//     .on('click', (event, d) => {
//         event.stopPropagation();
//         showNodeContext(d, nodes, links);
//         highlightConnections(d, nodes, links, node, link);
//     })
