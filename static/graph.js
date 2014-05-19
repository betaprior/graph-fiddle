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
	updateAnnotation: function(id, label, text, style) {
		var annot = this.d3el.selectAll(id).select("text");
		annot.select(".annotation-label").text(label);
		annot.select(".annotation-text").text(text);
		if (style) { annot.select(".annotation-text").style(style); }
	},
	updateSteps: function(n) {
		this.updateAnnotation("#status-steps", "Steps: ", String(n));
	},
	updateDist: function(n) {
		this.updateAnnotation("#status-dist", "Shortest path: ", String(n).replace("Infinity", "∞"));
	},
	updateOp: function(status, style) {
		this.updateAnnotation("#status-op", "Current comparison: ", status.replace("Infinity", "∞"), style);
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

/**
 * Graph objects are defined as follows:
 * 	 var graph = {links: {}, nodes: {}};
 *   links is an object keyed by edge id
 *   nodes is an object keyed by vertex name
 *   var links = {id1: edge1, id2: edge2, ... }
 *   var edge1 = {source: node1, target: node2, weight: 42, id: id1}
 *     source and target are actual references to node objects, (not labels!), id is an integer
 *   var nodes = {name1: node1, name2: node2, ... }
 *   var node1 = {adj: [edge5, edge6], name: name1, id: id1}
 *     name is a string, adj is is a list of outgoing edges (again, we store object references)
 *     id is a numeric ID
 *   Link and node objects are expected to be extended with other properties
 *   useful for graph traversal and visualization, e.g. distance from some source node,
 *   (x, y) coordinates of the node in visualization canvas, etc.
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
	graphElementPrototype: {
		addStatus: function(s) {
			this._status[s] = true;
		},
		addStickyStatus: function(s) {
			this._stickyStatus[s] = true;
		},
		hasStatus: function(s) {
			return _.has(this._status, s) || _.has(this._stickyStatus, s);
		},
		clearStatus: function() {
			this._status = {};
		},
		clearStickyStatus: function() {
			this._stickyStatus = {};
		},
		copyStatus: function(src) {
			this._status = _.clone(src._status);
		},
		getStatus: function(options) {
			options = options || {};
			var status = _.extend({}, this._status, this._stickyStatus);
			if (options.dict) {
				return status;
			} else if (options.list) {
				return _.keys(status);
			} else {
				return _.keys(status).join(" ");
			}
		}
	},
	graphElementAttrs: {
		_status: {},
		_stickyStatus: {}
	},
	makeLink: function(attrs) {
		var linkAttrs = attrs;
		var link = Object.create(this.graphElementPrototype);
		var elementAttrs = Object.create(this.graphElementAttrs);
		return _.extend(link, linkAttrs, {
			_status: {},
			_stickyStatus: {}
		});
	},
	makeNode: function(attrs) {
		var nodeAttrs = _.defaults(attrs, {
			adj: [],
			name: ""
		});
		var node = Object.create(this.graphElementPrototype);
		var elementAttrs = Object.create(this.graphElementAttrs);
		return _.extend(node, nodeAttrs, {
			_status: {},
			_stickyStatus: {}
		});
	},
	V: function() { return _.size(this.graph.nodes); },
	E: function() { return _.size(this.graph.links); },
	makeWorstCaseDijkstra: function(n) {
		var graph = this.graph = {links: {}, nodes: {}};
		if (n < 2) { return; }
		var node, link;
		var curLinkId = 0;
		var i = 0;
		// var srcNode = {adj: [], id: i, name: String(i)};
		var srcNode = this.makeNode({id: i, name: String(i)});
		graph.nodes[srcNode.id] = srcNode;
		for (i = 1; i < n; ++i) {
			node = this.makeNode({id: i, name: String(i)});
			graph.nodes[node.id] = node;
			link = this.makeLink({source: srcNode, target: node, weight: i - 1, id: curLinkId++});
			graph.nodes[srcNode.id].adj.push(link);
			graph.links[link.id] = link;
			for (var j = i - 1; j > 0; --j) {
				var weight = -Math.pow(2, i - 2) - i + j;
				link = this.makeLink({source: node, target: graph.nodes[String(j)], weight: weight, id: curLinkId++});
				graph.nodes[link.source.id].adj.push(link);
				graph.links[link.id] = link;
			}
		}
	}
});
