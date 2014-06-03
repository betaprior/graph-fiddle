var app = app || {};

/**
 *   Graph objects are defined as follows:
 *   	 var graph = {links: {}, nodes: {}};
 *     links is an object keyed by edge id
 *     nodes is an object keyed by vertex name
 *     var links = {id1: edge1, id2: edge2, ... }
 *     var edge1 = {source: node1, target: node2, weight: 42, id: id1}
 *       source and target are actual references to node objects, (not labels!), id is an integer
 *     var nodes = {name1: node1, name2: node2, ... }
 *     var node1 = {adj: [edge5, edge6], name: name1, id: id1}
 *       name is a string, adj is is a list of outgoing edges (again, we store object references)
 *       id is a numeric ID
 *     Link and node objects are expected to be extended with other properties
 *     useful for graph traversal and visualization, e.g. distance from some source node,
 *     (x, y) coordinates of the node in visualization canvas, etc.
 *
 *   TODO: refactor copy method
 */
app.GraphModel = Backbone.Model.extend({

	/**
	 *   Graph model initializer
	 *   options:
	 *   - V: number of vertices
	 */
	initialize: function(options) {
		options = options || {};
		var nVtxs = options.V || 5;
		this.graph = this.makeGraph();
		// TODO: FIXME: don't use a master model; instead, the global control
		// should iterate through views updating their graph models explicitly
		this.masterModel = options.masterModel || new Backbone.Model({V: nVtxs});
		this.listenTo(this.masterModel, "change:V", function() {
			this.set("V", this.masterModel.get("V"));
		}.bind(this));
		this.makeWorstCaseDijkstra(nVtxs);
	},

	/**
	 *   Basic API for graph data and operations
	 */
	graphPrototype: {
		clearStatus: function(options) {
			options = options || {};
			var clearStatus;
			if (options.sticky) {
				clearStatus = function(v) { v.clearStatus(); v.clearStickyStatus(); };
			} else {
				clearStatus = function(v) { v.clearStatus(); };
			}
			_(this.nodes).each(clearStatus);
			_(this.links).each(clearStatus);
		},
		addToPath: function(edge) {
			this.edgeTo[edge.target.id] = edge;
		},
		tracePath: function(target, options) {
			options = options || {};
			var path = [], edge;
			while ((edge = this.edgeTo[target.id])) {
				path.push(edge);
				target = edge.source;
				options.addStatus && this.links[edge.id].addStatus(options.addStatus);
				options.addStickyStatus && this.links[edge.id].addStickyStatus(options.addStickyStatus);
				options.removeStatus && this.links[edge.id].removeStatus(options.removeStatus);
				options.removeStickyStatus && this.links[edge.id].removeStickyStatus(options.removeStickyStatus);
			}
			path.reverse();
			return path;
		},
		// TODO: unf*ck this constructor logic
		copy: function() {
			var h = Object.create(Object.getPrototypeOf(this));
			// deep-copy the contents of graph elements
			h.links = {};
			h.nodes = {};
			_(this.links).each(function(v, k) {
				h.links[k] = v.copy();
			});
			_(this.nodes).each(function(v, k) {
				h.nodes[k] = v.copy();
			});
			h.edgeTo = _.clone(this.edgeTo);
			// shallow-copy all other attributes
			return _.defaults(h, this);
		}
	},
	makeGraph: function() {
		var g = Object.create(this.graphPrototype);
		g.links = {};
		g.nodes = {};
		g.edgeTo = {};
		return g;
	},

	/**
	 *   Basic API for graph elements (nodes and links) used for storing
	 *   state in graph traversal visualizations.
	 *   This might change a lot as vis code is evolving.
	 */
	graphElementPrototype: {
		addStatus: function(s) {
			this._status[s] = true;
		},
		removeStatus: function(s) {
			this._status[s] = false;
		},
		addStickyStatus: function(s) {
			this._stickyStatus[s] = true;
		},
		removeStickyStatus: function(s) {
			this._stickyStatus[s] = false;
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
		},
		copy: function() {
			var c = Object.create(Object.getPrototypeOf(this));
			// create deep copy
			var cpy = $.extend(true, {}, this);
			// but only copy own properties
			for (var attr in this) {
				if (this.hasOwnProperty(attr)) {
					c[attr] = cpy[attr];
				}
			}
			return c;
		}
	},

	// common attributes for graph element objects
	_graphElementAttrs: {
		_status: {},
		_stickyStatus: {}
	},

	/**
	 *   Factory method for making graph links
	 */
	makeLink: function(attrs) {
		var link = Object.create(this.graphElementPrototype);
		attrs = $.extend(true, attrs, this._graphElementAttrs);
		for (var a in attrs) {
			link[a] = attrs[a];
		}
		return link;
	},

	/**
	 *   Factory method for making graph nodes
	 */
	makeNode: function(attrs) {
		attrs = _.defaults(attrs, {
			adj: [],
			name: ""
		});
		attrs = $.extend(true, attrs, this._graphElementAttrs);
		var node = Object.create(this.graphElementPrototype);
		for (var a in attrs) {
			node[a] = attrs[a];
		}
		return node;
	},

	V: function() { return _.size(this.graph.nodes); },

	E: function() { return _.size(this.graph.links); },

	/**
	 *   getGraphTypes
	 *
	 *   Retrieve the list of graph types this object provides, along with their
	 *   titles and creation functions. This list is returned as an object keyed by graph type ID:
	 *   {dijkstra: {title: "Dijkstra", make: [reference to makeWorstCaseDijkstra]}}
	 *
	 *   Options:
	 *   - titleOnly: if true, return {id: title} objects only, e.g. ({bst: "BST", wd: "Worst Dijkstra"})
	 */
	getGraphTypes: function(options) {
		options = options || {};
		var graphTypes = {
			worst_dijkstra: {title: "Worst Dijkstra DAG", make: _.bind(this.makeWorstCaseDijkstra, this)},
			bst: {title: "Binary Search Tree", make: function() {}}
		};
		if (options.titleOnly) {
			_.each(graphTypes, function(v, k) { graphTypes[k] = v.title; });
		}
		return graphTypes;
	},

	makeWorstCaseDijkstra: function(n) {
		var graph = this.graph = this.makeGraph();
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
