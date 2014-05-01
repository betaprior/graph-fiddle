var app = app || {};

app.GraphView = Backbone.View.extend({
	initialize: function() {
		this.width = 400;
		this.height = 400;
		this.nodeR = 20;
		this.graphPromise = this.getData("files/a4.txt");
	},
	render: function() {
		this.graphPromise.done(function(graph) {
			this.renderGraph(graph);
		}.bind(this));
		return this;
	},
	updateSteps: function(n) {
		d3.selectAll("#status-steps").select("text").text("Steps: " + n);
	},
	updateDist: function(n) {
		n = n === Infinity ? '∞' : n;
		d3.selectAll("#status-dist").select("text").text("Shortest path: " + n);
	},
	updateOp: function(status, style) {
		status = status.replace("Infinity", "∞");
		var text = d3.selectAll("#status-op").select("text")
				.html('<tspan id="annotation">Current comparison: </tspan><tspan id="comparison">'
					  + status + '</tspan>');
		if (style)
			text.select("#comparison").style(style);
	},
	renderGraph: function(graph) {
		var svg = this.prepSvg(this.width, this.height);

		svg.append("svg:g")
			.attr("id", "status-steps")
			.attr("transform", "translate(10, 10)")
			.append("text")
			.attr("dy", ".35em");

		svg.append("svg:g")
			.attr("id", "status-dist")
			.attr("transform", "translate(80, 10)")
			.append("text")
			.attr("dy", ".35em");

		svg.append("svg:g")
			.attr("id", "status-op")
			.attr("transform", "translate(180, 10)")
			.append("text")
			.attr("dy", ".35em");

		this.updateSteps(0);
		this.updateDist("∞");

		var force = d3.layout.force()
				.nodes(d3.values(graph.nodes))
				.links(d3.values(graph.links))
				.size([this.width, this.height])
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
		node.append("circle").attr("r", this.nodeR);
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
		var that = this;
		function tick() {
			var nodeR = that.nodeR;
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
	},
	// name: marker name that will be used to assign lines to markers:
	// attr("marker-end", "url(#NAME)")
	// classes: object with class names to assign to the marker path in the format
	// {"class1": true, "class2": true}
	makeMarkers: function(svg, name, classes) {
		var markers = svg.append("svg:defs").selectAll("marker")
				.data([name])      // Different link/path types can be defined here
				.enter().append("svg:marker")    // This section adds in the arrows
				.attr("id", String)
				.attr("viewBox", "0 -5 10 10")
				.attr("refX", 7)
				.attr("refY", 0)
				.attr("markerWidth", 6)
				.attr("markerHeight", 6)
				.attr("orient", "auto");
		var path = markers.append("svg:path")
				.attr("d", "M0,-5L10,0L0,5");
		if (classes) {
			path.classed(classes);
		}
	},
	prepSvg: function(width, height) {
		d3.select(this.el).html("");
		var svg = d3.select(this.el).append("svg")
				.attr("width", width)
				.attr("height", height);

		// build the arrow end markers
		this.makeMarkers(svg, "end");
		this.makeMarkers(svg, "end-active", {"arrowhead": true, "active": true});
		return svg;
	},
	getData: function(url) {
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
				var weight = +fields[2];
				var link = {}; // temporary link object
				var nodes = graph.nodes;
				link.source = nodes[source] || (nodes[source] = {name: source});
				link.target = nodes[target] || (nodes[target] = {name: target});
				link.weight = weight;
				link.id = linkId;
				graph.links[linkId] = link;
				if (!nodes[source].adj) { nodes[source].adj = []; }
				if (!nodes[target].adj) { nodes[target].adj = []; }
				nodes[source].adj.push(link);
				linkId++;
			});
			promise.resolve(graph);
		});
		return promise;
	}
});

/* Graph objects are defined as follows:
 * 	 var graph = {links: {}, nodes: {}};
 *   links is an object keyed by edge id
 *   nodes is an object keyed by vertex name
 *   var links = {id: {source: node1, target: node2, weight: 42, id: id}, ... }
 *     source and target are actual references to node objects, (not labels!), id is an integer
 *   var nodes = {name: {adj: [], name: name}, ... }
 *     name is a string, adj is is a list of outgoing edges (again, we store object references)
 *
 *   Using string-valued names to keep track of vertices is often more convenient than
 *   using sequential integer-valued vertex IDs.
 */
app.GraphModel = Backbone.Model.extend({
	initialize: function(options) {
		options = options || {};
		var nVtxs = options.V || 7;
		this.makeWorstCaseDijkstra(nVtxs);
		Backbone.Model.prototype.initialize.apply(this, arguments);
	},
	makeWorstCaseDijkstra: function(n) {
		if (n < 2) { this.graph = null; }
		var graph = {links: {}, nodes: {}};
		var node, link;
		var curId = 0;
		var srcNode = {adj: [], name: "0"};
		graph.nodes[srcNode.name] = srcNode;
		for (var i = 1; i < n; ++i) {
			node = {adj: [], name: String(i)};
			graph.nodes[node.name] = node;
			link = {source: srcNode, target: node, weight: i - 1, id: curId++};
			graph.nodes[srcNode.name].adj.push(link);
			graph.links[link.id] = link;
			for (var j = i - 1; j > 0; --j) {
				var weight = -Math.pow(2, i - 2) - i + j;
				link = {source: node, target: graph.nodes[String(j)], weight: weight, id: curId++};
				graph.nodes[link.source.name].adj.push(link);
				graph.links[link.id] = link;
			}
		}
		this.graph = graph;
	}
});
