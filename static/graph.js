var app = app || {};

app.GraphView = Backbone.View.extend({
	initialize: function(options) {
		options = options || {};
		if (options.loadData) {
			this.graphPromise = this.getData(options.loadData);
		}
		this.options = _.defaults(options, {nodeLabels: false});
		this.width = 400;
		this.height = 400;
		this.nodeR = 20;
		this.d3el = d3.select(this.el);
		this.cola = cola;
	},
	render: function() {
		if (this.graphPromise !== void 0) {
			this.graphPromise.done(function(graph) {
				this.renderGraph(graph, options);
			}.bind(this));
		} else {
			this.renderGraph(this.model.graph);
		}
		return this;
	},
	updateSteps: function(n) {
		this.d3el.selectAll("#status-steps").select("text").text("Steps: " + n);
	},
	updateDist: function(n) {
		n = n === Infinity ? '∞' : n;
		this.d3el.selectAll("#status-dist").select("text").text("Shortest path: " + n);
	},
	updateOp: function(status, style) {
		status = status.replace("Infinity", "∞");
		var text = this.d3el.selectAll("#status-op").select("text");
		text.select("#comparison").text(status);
		if (style)
			text.select("#comparison").style(style);
	},
	renderGraph: function(graph) {
		var svg = this.prepSvg(this.width, this.height);
		var nodeValues = d3.values(graph.nodes);
		var linkValues = d3.values(graph.links);

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

		var d3status_op_text = svg.append("svg:g")
				.attr("id", "status-op")
				.attr("transform", "translate(180, 10)")
				.append("text")
				.attr("dy", ".35em");
		d3status_op_text.append("tspan")
			.attr("id", "annotation")
			.text("Current comparison: ");
		d3status_op_text.append("tspan")
			.attr("id", "comparison");

		this.updateSteps(0);
		this.updateDist("∞");

		var cola = this.cola.d3adaptor()
				.linkDistance(250)
				.handleDisconnected(true)
				.size([this.width, this.height]);
		cola.nodes(nodeValues)
			.links(linkValues)
			.on("tick", tick)
			.start(30);

		// bind the edges
		var d3linksEnter = svg.append("svg:g").selectAll(".link")
				.data(linkValues)
				.enter();
		var path = d3linksEnter.append("svg:path")
				.attr("id", function(d) {
					return "link" + d.id;
				})
				.attr("class", "link")
				.attr("marker-end", "url(#end)");
		var pathLabels = d3linksEnter.append("g")
				.each(function(d) {
					var dx = d.target.x - d.source.x,
						dy = d.target.y - d.source.y,
						dr = Math.sqrt(dx * dx + dy * dy);
					var rhat_x = dx / dr, rhat_y = dy / dr;
					var rnd = 0.1 * (Math.random() - 1);
					d._labelOffsetX = rnd * dr * rhat_x;
					d._labelOffsetY = rnd * dr * rhat_y;
				})
				.attr("transform", function(d) {
					var x = d.source.x + (d.target.x - d.source.x) / 2 + d._labelOffsetX;
					var y = d.source.y + (d.target.y - d.source.y) / 2 + d._labelOffsetY;
					return "translate(" + x + "," + y + ")";
				});

		pathLabels.append("text")
			.text(function(d) { return d.weight; });

		// bind the nodes
		var node = svg.selectAll(".node")
				.data(nodeValues)
				.enter().append("g")
				.attr("id", function(d) {
					return "node" + d.name;
				})
				.attr("class", "node")
				.call(cola.drag);

		// add nodes
		node.append("circle").attr("r", this.nodeR);
		// add path distance info text
		node.append("text")
			.attr("class", "dist")
			.attr("text-anchor", "middle")
			.attr("dy", "3px")
			.attr("x", 0)
			.text(function(d) { return d.dist; });

		// add labels
		if (this.options.nodeLabels) {
			node.append("text")
				.attr("x", 22)
				.attr("dy", ".35em")
				.text(function(d) { return d.name; });
		}

		// style source and target nodes
		this.d3el.select("#node" + this.source)
			.classed({"source": true});
		this.d3el.select("#node" + this.target)
			.classed({"target": true});


		// add the curvy lines
		var that = this;
		function tick() {
			var nodeR = that.nodeR;
			var rscale = 4;
			var rhat_scale = rscale * 1.5;

			pathLabels.attr("transform", function(d) {
				var x = d.source.x + (d.target.x - d.source.x) / 2 + d._labelOffsetX;
				var y = d.source.y + (d.target.y - d.source.y) / 2 + d._labelOffsetY;
				return "translate(" + x + "," + y + ")";
			});

			path.attr("d", function(d) {
				var dx = d.target.x - d.source.x,
					dy = d.target.y - d.source.y,
					dr = rscale * Math.sqrt(dx * dx + dy * dy);
				var rhat_x = rhat_scale * dx / dr, rhat_y = rhat_scale * dy / dr;
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

/**
 * Graph objects are defined as follows:
 * 	 var graph = {links: {}, nodes: {}};
 *   links is an object keyed by edge id
 *   nodes is an object keyed by vertex name
 *   var links = {id1: edge1, id2: edge2, ... }
 *   var edge1 = {source: node1, target: node2, weight: 42, id: id1}
 *     source and target are actual references to node objects, (not labels!), id is an integer
 *   var nodes = {name1: node1, name2: node2, ... }
 *   var node1 = {adj: [edge5, edge6], name: name1}
 *     name is a string, adj is is a list of outgoing edges (again, we store object references)
 *
 *   Using string-valued names to keep track of vertices is often more convenient than
 *   using sequential integer-valued vertex IDs.
 */
app.GraphModel = Backbone.Model.extend({
	initialize: function(options) {
		options = options || {};
		var nVtxs = options.V || 7;
		this.graph = {links: {}, nodes: {}};
		this.masterModel = options.masterModel || new Backbone.Model({V: 4});
		this.listenTo(this.masterModel, "change:V", function() {
			this.set("V", this.masterModel.get("V"));
		}.bind(this));
		this.makeWorstCaseDijkstra(nVtxs);
		Backbone.Model.prototype.initialize.apply(this, arguments);
	},
	V: function() { return _.size(this.graph.nodes); },
	E: function() { return _.size(this.graph.links); },
	makeWorstCaseDijkstra: function(n) {
		var graph = this.graph = {links: {}, nodes: {}};
		if (n < 2) { return; }
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
	}
});
