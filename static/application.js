var points = [];
var width = 960, height = 500;
var nodeR = 20;
var svg;

function placeSVG() {
	svg = d3.select("#svg-container").append("svg");
	svg.attr("class", "rect-main")
		.attr("width", width)
		.attr("height", height)
	;
}

function refreshSVG() {
	console.log(points);
	svg.selectAll("circle.point").data(points).enter()
		.append("svg:circle")
		.attr("class", "point")
		.attr("r", 4)
		.attr("cx", function(d) { return d[0]; })
		.attr("cy", function(d) { return d[1]; });
}

function getData(url) {
	var promise = $.Deferred();
	var graph = {links: {}, nodes: {}};
	graph.edges = graph.links; graph.vertices = graph.nodes; // aliases
	d3.text(url, function(error, data) {
		if (error) {
			promise.reject();
			return;
		}
		var lines = data.split("\n");
		graph.V = +$.trim(lines[0]);
		graph.E = +$.trim(lines[1]);
		var linkId = 0;  
		_(lines.slice(2)).each(function(x) {
			var fields = $.trim(x).split(/\s+/);
			if (fields.length < 3) return;
			var source = fields[0]; 
			var target = fields[1];
			var value = +fields[2];
			var link = {}; // temporary link object
			var nodes = graph.nodes;
			link.source = nodes[source] || (nodes[source] = {name: source});
			link.target = nodes[target] || (nodes[target] = {name: target});
			link.value = value;
			link.id = linkId;
			graph.links[linkId] = link;
			if (!nodes[source].adj) { nodes[source].adj = []; }
			if (!nodes[target].adj) { nodes[target].adj = []; }
			nodes[source].adj.push(linkId);
			linkId++;
		});
		promise.resolve(graph);
	});
	return promise;
}
		

function prepSvg(width, height) {
	var svg = d3.select("body").append("svg")
		.attr("width", width)
		.attr("height", height);

	// build the arrow.
	svg.append("svg:defs").selectAll("marker")
		.data(["end"])      // Different link/path types can be defined here
		.enter().append("svg:marker")    // This section adds in the arrows
		.attr("id", String)
		.attr("viewBox", "0 -5 10 10")
		.attr("refX", 7)
		.attr("refY", 0)
		.attr("markerWidth", 6)
		.attr("markerHeight", 6)
		.attr("orient", "auto")
		.append("svg:path")
		.attr("d", "M0,-5L10,0L0,5");
	
	return svg;
}
	
function renderGraph(graph) {
	var svg = prepSvg(width, height);
	
	var force = d3.layout.force()
		.nodes(d3.values(graph.nodes))
		.links(d3.values(graph.links))
		.size([width, height])
		.linkDistance(260)
		.charge(-100)
		.on("tick", tick)
		.start();

	// bind the edges
	var path = svg.append("svg:g").selectAll("path")
		.data(force.links())
		.enter().append("svg:path")
		.attr("id", function(d) {
			return "link" + d.id;
		})
		.attr("class", "link")
		.attr("marker-end", "url(#end)");
	
	// bind the nodes
	var node = svg.selectAll(".node")
		.data(force.nodes())
		.enter().append("g")
		.attr("id", function(d) { 
			return "node" + d.name;
		})
		.attr("class", "node")
		.call(force.drag);
	
	// add nodes
	node.append("circle").attr("r", nodeR);
	// add weights
	node.append("text")
		.attr("class", "dist")
		.attr("text-anchor", "middle")	
		.attr("dy", "3px")
		.attr("x", 0)
		.text(function(d) { return d.dist; });

	// add labels
	node.append("text")
		.attr("x", 22)
		.attr("dy", ".35em")
		.text(function(d) { return d.name; });

	// add the curvy lines
	function tick() {
		path.attr("d", function(d) {
			var dx = d.target.x - d.source.x,
            dy = d.target.y - d.source.y,
            dr = Math.sqrt(dx * dx + dy * dy);
			var rhat_x = 1.5 * dx / dr, rhat_y = 1.5 * dy / dr;
			var sx = d.source.x + nodeR * rhat_x,
			sy = d.source.y + nodeR * rhat_y,
			tx = d.target.x - nodeR * rhat_x,
			ty = d.target.y - nodeR * rhat_y;
			return "M" + 
				sx + "," + 
				sy + "A" + 
				dr + "," + dr + " 0 0,1 " + 
				tx + "," + 
				ty;
		});

		node.attr("transform", function(d) { 
			return "translate(" + d.x + "," + d.y + ")"; 
		});
	}
	
	// cool down the force layout
	var k = 0;
	while ((force.alpha() > 1e-2) && (k < 150)) {
		force.tick();
		k = k + 1;
	}	
}

function displayNodeDist(node, style, cls) {
	var sel = d3.selectAll("#node" + node.name).select("text");
	sel.text(function(d) { 
		return d.dist === Infinity ? '∞' : d.dist;
	});
	if (style) { sel.style(style); }
	if (cls) { sel.classed(cls, true); }
}

function showNodeDist(node, dist, cls) {
	var sel = d3.selectAll("#node" + node.name).select("text");
	sel.text(function(d) { return dist === Infinity ? '∞' : dist; });
	if (cls) { sel.classed(cls, true); }
}

function initializeDistViz(graph, source) {
	_(graph.nodes).each(function(x) {
		x.dist = Infinity;
		displayNodeDist(x);
	});
	graph.nodes[source].dist = 0;
	displayNodeDist(graph.nodes[source]);
}

function initializeDist(graph, source) {
	_(graph.nodes).each(function(x) {
		x.dist = Infinity;
	});
	graph.nodes[source].dist = 0;
}

function isTense(edge) {
	return edge.target.dist > edge.source.dist + edge.value;
}

function relax(edge) {
	edge.target.dist = edge.source.dist + edge.value;
	return edge.target.dist;
}

function relaxViz(edge) {
	edge.target.dist = edge.source.dist + edge.value;
	var d = edge.target.dist;
	// displayNodeDist(edge.target, {"font-weight": "bold", "fill": "green"});
	displayNodeDist(edge.target, null, "relaxing");
	return d;
}

function makeIndexedPQ() {
	var pq = {};
	pq.q = [];
	pq.isEmpty = function() { return _.size(pq.q) === 0; };
	pq.push = function(x, priority) { 
		var obj = {v: x, p: priority};
		pq.q.push(obj);
		return obj;
	};
	pq.changeKey = function(handle, newKey) { handle.p = newKey; };
	pq.deleteMin = function() {
		var obj = _(pq.q).min(function(x) { return x.p; });
		var i = _(pq.q).indexOf(obj);
		pq.q.splice(i, 1);
		return obj.v;
	};
	return pq;
}

function runBellmanFord(graph, source, target) {
	initializeDist(graph, source);
	_(graph.nodes).each(function(v, k) {
		_(graph.edges).each(function(edge, k) {
			if (isTense(edge)) { relax(edge); }
		});
	});
	console.log("At the end of BF, source->target dist is " + graph.nodes[target].dist);
}

function runBellmanFordViz1(graph, source, target) {
	var countV = 0;
	var timeout = 100;
	var edges = d3.values(graph.edges);
	var doVertex = function() {
		console.log("Doing vertex " + countV);
		countV++;
		doEdge(0);
	};
	var doEdge = function(i, prev) {
		console.log("doing edge " + i);
		d3.select("#link" + edges[i].id)
			.classed("visiting", true);
		if (prev) {
			d3.select("#link" + edges[prev].id)
				.classed("visiting", false);
		}
		if (isTense(edges[i])) { relax(edges[i]); }
		if (i == graph.E - 1) {
			if (countV == graph.V - 1) {
				return;
			} else {
				setTimeout(doVertex, timeout);
			}
		} else {
			setTimeout(function() { doEdge(i + 1, i); }, timeout);
		}
	};
	doVertex();
}

function runBellmanFordViz(graph, source, target) {
	var timeout = 1000;
		
	var actions = [];
	initializeDistViz(graph, source);
	_(graph.nodes).each(function(vtx, name) {
		_(graph.edges).each(function(edge, id) {
			var action = function(edge, id) {
				return function() {
					// console.log("Visiting link with id " + id);
					d3.selectAll("[id^=link]").classed("visiting", false);
					d3.selectAll("text.dist").classed("relaxing", false);
					d3.selectAll("#link" + id).classed("visiting", true);
					if (isTense(edge)) { relaxViz(edge); }
				};
			};
			actions.push(action(edge, id));
		});
	});
	
	var deselectAll = function() {
		d3.selectAll("[id^=link]").classed("visiting", false);
	};
	
	var runActions = function(i) {
		i = i || 0;
		actions[i]();
		if (i < actions.length - 1)
			setTimeout(function() { runActions(i+1); }, timeout);
		else
			setTimeout(deselectAll, timeout);
	};
	
	runActions();
	console.log("At the end of BF, source->target dist is " + graph.nodes[target].dist);
}


function runDijkstra(graph, source, target) {
	initializeDist(graph, source);
	var pq = makeIndexedPQ();
	var node = graph.nodes[source];
	node.pqHandle = pq.push(node, node.dist);
	while (!pq.isEmpty()) {
		var curNode = pq.deleteMin();
		curNode.pqHandle = null;
		for (var i = 0; i < curNode.adj.length; i++) {
			var edge = graph.links[curNode.adj[i]];
			if (isTense(edge)) {
				var newDist = relax(edge);
				if (edge.target.pqHandle) {
					pq.changeKey(pqHandle, newDist);
				} else {
					edge.target.pqHandle = pq.push(edge.target, newDist);
				}
			}
		}
	}
	console.log("At the end of Dijkstra, source->target dist is " + graph.nodes[target].dist);
}

function runDijkstraViz(graph, source, target) {
	initializeDistViz(graph, source);
	var actions = [];
	var timeout = 1000;
	var pq = makeIndexedPQ();
	var node = graph.nodes[source];
	node.pqHandle = pq.push(node, node.dist);
	while (!pq.isEmpty()) {
		var curNode = pq.deleteMin();
		curNode.pqHandle = null;
		for (var i = 0; i < curNode.adj.length; i++) {
			var edge = graph.links[curNode.adj[i]];
			var newDist;
			var step = {edge: edge, newDist: newDist, relaxing: false};
			if (isTense(edge)) {
				step.relaxing = true;
				newDist = relax(edge);
				step.newDist = newDist;
				if (edge.target.pqHandle) {
					pq.changeKey(pqHandle, newDist);
				} else {
					edge.target.pqHandle = pq.push(edge.target, newDist);
				}
			}
			actions.push(step);
		}
	}
	var vizStep = function(step) {
		d3.selectAll("[id^=link]").classed("visiting", false);
		d3.selectAll("text.dist").classed("relaxing", false);
		d3.selectAll("#link" + step.edge.id).classed("visiting", true);
		if (step.relaxing) {
			showNodeDist(step.edge.target, newDist, "relaxing");
		}
	};
	
	var deselectAll = function() {
		d3.selectAll("[id^=link]").classed("visiting", false);
		d3.selectAll("text.dist").classed("relaxing", false);
	};
	
	var runActions = function(i) {
		i = i || 0;
		vizStep(actions[i]);
		if (i < actions.length - 1)
			setTimeout(function() { runActions(i+1); }, timeout);
		else
			setTimeout(deselectAll, timeout);
	};
	
	runActions();
		
	console.log("At the end of Dijkstra, source->target dist is " + graph.nodes[target].dist);
}


$(document).ready(function() {
	
	getData("files/a4.txt")
		.done(function(graph) {
			renderGraph(graph);
			// runBellmanFordViz(graph, "0", "1");
			runDijkstraViz(graph, "0", "1");
		});
	// var foo = makeIndexedPQ();
	// foo.push("a", 10);
	// var h = foo.push("b", 0);
	// foo.push("c", 100);
	// foo.changeKey(h, -100);
	// console.log(foo.deleteMin());
});
