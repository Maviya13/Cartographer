// Helper functions for graph context panel - ADD BEFORE })(); closing

// Helper: Show node context panel
function showNodeContext(selectedNode, allNodes, allLinks) {
    const panel = document.getElementById('graph-context');
    const title = document.getElementById('context-title');
    const content = document.getElementById('context-content');

    if (!panel || !title || !content) return;

    title.textContent = selectedNode.label;

    // Find connections
    const callers = allLinks.filter(l => {
        const targetId = l.target.id || l.target;
        return targetId === selectedNode.id && l.type === 'CALLS';
    });
    const callees = allLinks.filter(l => {
        const sourceId = l.source.id || l.source;
        return sourceId === selectedNode.id && l.type === 'CALLS';
    });
    const imports = allLinks.filter(l => {
        const sourceId = l.source.id || l.source;
        return sourceId === selectedNode.id && l.type === 'IMPORTS';
    });

    let html = `<p><strong>Type:</strong> ${selectedNode.type}</p>`;

    if (selectedNode.isolated) {
        html += `<p><strong>Status:</strong> <span style="color: #cca700;">⚠️ ISOLATED</span></p>`;
        html += `<p style="color: var(--vscode-descriptionForeground); font-size: 0.9em;">This node has no connections. It might be:</p>`;
        html += `<ul style="font-size: 0.9em;"><li>Dead code (can be removed)</li><li>Entry point (like main())</li><li>Standalone utility</li></ul>`;
    } else {
        html += `<p><strong>Risk:</strong> <span class="tag-${selectedNode.risk.toLowerCase()}">${selectedNode.risk}</span></p>`;
        html += `<p><strong>Centrality:</strong> ${selectedNode.centrality || 0}</p>`;
    }

    html += `<hr style="border-color: var(--vscode-panel-border); margin: 10px 0;">`;

    html += `<h4 style="margin: 10px 0;">💥 What breaks if I change this?</h4>`;
    if (callers.length > 0) {
        html += `<p><strong>${callers.length} function(s)</strong> call this:</p><ul style="max-height: 150px; overflow-y: auto;">`;
        callers.slice(0, 10).forEach(l => {
            const callerId = l.source.id || l.source;
            const caller = allNodes.find(n => n.id === callerId);
            if (caller) html += `<li style="font-size: 0.9em;">${caller.label}</li>`;
        });
        if (callers.length > 10) html += `<li>... and ${callers.length - 10} more</li>`;
        html += `</ul>`;
    } else {
        html += `<p style="color: #89d185; font-size: 0.9em;">✅ Nothing calls this. Safe to modify!</p>`;
    }

    if (callees.length > 0) {
        html += `<h4 style="margin: 10px 0;">📞 This calls:</h4><ul style="max-height: 100px; overflow-y: auto;">`;
        callees.slice(0, 5).forEach(l => {
            const calleeId = l.target.id || l.target;
            const callee = allNodes.find(n => n.id === calleeId);
            if (callee) html += `<li style="font-size: 0.9em;">${callee.label}</li>`;
        });
        if (callees.length > 5) html += `<li>... and ${callees.length - 5} more</li>`;
        html += `</ul>`;
    }

    if (imports.length > 0) {
        html += `<h4 style="margin: 10px 0;">📦 Imports:</h4><ul>`;
        imports.slice(0, 3).forEach(l => {
            const impId = l.target.id || l.target;
            const imp = allNodes.find(n => n.id === impId);
            if (imp) html += `<li style="font-size: 0.9em;">${imp.label}</li>`;
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
        const sourceId = l.source.id || l.source;
        const targetId = l.target.id || l.target;

        if (sourceId === selectedNode.id || targetId === selectedNode.id) {
            connectedIds.add(sourceId);
            connectedIds.add(targetId);
            connectedLinkIds.add(`${sourceId}-${targetId}`);
        }
    });

    // Highlight/dim nodes
    nodeSelection.classed('highlighted', d => d.id === selectedNode.id);
    nodeSelection.classed('dimmed', d => !connectedIds.has(d.id));

    // Highlight/dim links
    linkSelection.classed('highlighted', d => {
        const sourceId = d.source.id || d.source;
        const targetId = d.target.id || d.target;
        return connectedLinkIds.has(`${sourceId}-${targetId}`);
    });
    linkSelection.classed('dimmed', d => {
        const sourceId = d.source.id || d.source;
        const targetId = d.target.id || d.target;
        return !connectedLinkIds.has(`${sourceId}-${targetId}`);
    });
}

// Clear selection button
document.getElementById('clearSelection')?.addEventListener('click', () => {
    document.querySelectorAll('.node').forEach(n => {
        n.classList.remove('highlighted', 'dimmed');
    });
    document.querySelectorAll('.link').forEach(l => {
        l.classList.remove('highlighted', 'dimmed');
    });
    const panel = document.getElementById('graph-context');
    if (panel) panel.style.display = 'none';
});

// Click outside to clear
document.getElementById('graph-container')?.addEventListener('click', (e) => {
    if (e.target.tagName === 'svg' || e.target.id === 'graph-container') {
        document.querySelectorAll('.node').forEach(n => {
            n.classList.remove('highlighted', 'dimmed');
        });
        document.querySelectorAll('.link').forEach(l => {
            l.classList.remove('highlighted', 'dimmed');
        });
        const panel = document.getElementById('graph-context');
        if (panel) panel.style.display = 'none';
    }
});
