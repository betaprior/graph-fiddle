var app = app || {};

/**
 *   Base graph view for visualizations.
 *
 *   Renders graph on an SVG canvas; uses cola.js for layout
 *   (http://marvl.infotech.monash.edu/webcola/)
 *   as a drop-in replacement for d3 force directed layout.
 */
app.GraphView = Backbone.View.extend({
	/**
	 *   Initializer/constructor options:
	 *   required:
	 *   - model: GraphModel for this graph
	 *   optional:
	 *   - nodeLabels: whether to show node labels
	 *   - loadData
	 */
	initialize: function(options) {
		options = options || {};
		// TODO: test and improve loading from files
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
				this.renderGraph(graph);
			}.bind(this));
		} else {
			this.renderGraph(this.model.graph);
		}
		return this;
	},

	addNodeClass: function(id, class_) {
		this.d3el.select("#node" + id).classed(class_, true);
	},

	addLinkClass: function(id, class_) {
		this.d3el.select("#link" + id).classed(class_, true);
	},

	renderAnnotations: function(annotations) {
		var d3annotations = this.d3el.select("#annotations").selectAll(".annotation-item")
				.data(annotations);

		var d3text = d3annotations.enter()
				.append("g")
				.attr("id", function(d, i) { return "annotation-" + i; })
				.attr("class", "annotation-item")
				.append("text")
				.attr("dy", ".35em")
				.attr("transform", function(d, i) {
					return "translate(0, " + 20 * i + ")";
				});
		d3text.append("tspan").attr("class", "annotation-label");
		d3text.append("tspan").attr({"xml:space": "preserve"}).text(" ");
		d3text.append("tspan").attr("class", "annotation-text");
		d3annotations.select(".annotation-label").text(function(d) { return d.label; });
		d3annotations.select(".annotation-text").text(function(d) { return d.text; })
			.each(function(d) {
				if (d.style) { d3.select(this).style(d.style); }
			});
	},

	renderGraph: function(graph) {
		var svg = this.prepSvg(this.width, this.height);
		var nodeValues = d3.values(graph.nodes);
		var linkValues = d3.values(graph.links);

		var annotations = svg.append("g")
				.attr("id", "annotations")
				.attr("transform", "translate(10, 10)");

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
					return "node" + d.id;
				})
				.attr("class", "node")
				.call(cola.drag);

		// add nodes
		node.append("circle").attr("r", this.nodeR);
		// add path distance info text
		node.append("text")
			.attr("class", "node-text")
			.attr("text-anchor", "middle")
			.attr("dy", "3px")
			.attr("x", 0);
			// .text(function(d) { return d.dist; });

		// add labels
		if (this.options.nodeLabels) {
			node.append("text")
				.attr("x", 22)
				.attr("dy", ".35em")
				.text(function(d) { return d.name; });
		}

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

	// TODO: move this over to graph model
	getData: function(url) {
		var promise = $.Deferred();
		var graph = {links: {}, nodes: {}};
		graph.edges = graph.links; graph.vertices = graph.nodes; // aliases
		var idMapping = {}; // name to ID mapping for nodes
		d3.text(url, function(error, data) {
			if (error) {
				promise.reject();
				return;
			}
			var lines = data.split("\n");
			graph.V = +$.trim(lines[0]);
			graph.E = +$.trim(lines[1]);
			var linkId = 0, nodeId = 0;
			_(lines.slice(2)).each(function(x) {
				var fields = $.trim(x).split(/\s+/);
				if (fields.length < 3) return;
				var source = fields[0];
				var target = fields[1];
				var sourceId = source in idMapping ? source : nodeId++;
				var targetId = target in idMapping ? target : nodeId++;
				var weight = +fields[2];
				var link = {}; // temporary link object
				var nodes = graph.nodes;
				link.source = nodes[sourceId] || (nodes[sourceId] = this.model.makeNode({name: source, id: sourceId}));
				link.target = nodes[targetId] || (nodes[targetId] = this.model.makeNode({name: target, id: targetId}));
				link.weight = weight;
				link.id = linkId;
				graph.links[linkId] = this.model.makeLink(link);
				// if (!nodes[sourceId].adj) { nodes[sourceId].adj = []; }
				// if (!nodes[targetId].adj) { nodes[targetId].adj = []; }
				nodes[sourceId].adj.push(link);
				linkId++;
			});
			promise.resolve(graph);
		});
		return promise;
	}
});
