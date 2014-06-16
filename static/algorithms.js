var app = app || {}; // The Application


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

/**
 *   Graph Simulation View class extended to handle a particular algorithm example
 *
 *   Arguments:
 *   - model: graph model
 *   - graph_type: graph type
 *   - animationModel
 */
app.AnimatedSimulationBase = app.GraphSimulationView.extend({
	initialize: function() {
		app.GraphSimulationView.prototype.initialize.apply(this, arguments);
	},
	render: function() {
		this.actions = [];
		this.model.graph.clearStatus();
		this.renderGraph(this.model.graph);
		this.recordAnimatedAlgorithm(this.model.graph);
		return this;
	},
	// Proxy some graph methods here to make the API less confusing
	// for the algorithm methods
	addToPath: function() {
		return this.model.graph.addToPath.apply(this.model.graph, arguments);
	},
	tracePath: function() {
		return this.model.graph.tracePath.apply(this.model.graph, arguments);
	},
	/**
	 * Stub function for algo recording
	 */
	recordAnimatedAlgorithm: function(graph) {
	}
});

/**
 *   registerAlgorithm
 *
 *   Insert an algorithm code snippet into the app's global `algorithms` object
 *
 *   The global `algorithms` object is keyed by the algorithm ID and has properties:
 *   - title: algorithm title
 *   - code: executable function that takes graph as a parameter and precomputes the visualization
 *   TODO: refactor the algorithms data structures (i.e. merge this code with the algorithm model
 *         in editor.js)
 *
 *   Arguments:
 *   -params: object with fields {id, title, code}
 */
app.registerAlgorithm = function(params) {
	app.algorithms = app.algorithms || {};
	if (!(params.id && params.title && params.code)) {
		throw new Error("params object must provide id, title, and code");
	}
	app.algorithms[params.id] = {title: params.title, code: params.code};
};


app.registerAlgorithm({
	id: "dijkstra",
	title: "Dijkstra's algorithm",
	code: function() {
		var source = getSource();
		var target = getTarget();
		initializeDistances(graph, source.id);
		addNodeClass(source.id, "source");
		addNodeClass(target.id, "target");

		var edgeTo = {};
		var curDist = graph.nodes[target.id].dist;
		var annotations = [makeStepAnnotation(null, {text: ""}), makeShortestPathAnnotation(curDist)];
		initializeAnnotations(annotations);
		var pq = makeIndexedPQ();
		var node = graph.nodes[source.id];
		node.pqHandle = pq.push(node, node.dist);
		while (!pq.isEmpty()) {
			var curNode = pq.deleteMin();
			curNode.pqHandle = null;
			if (curNode.id === target.id) { continue; }
			for (var i = 0; i < curNode.adj.length; i++) {
				var edge = curNode.adj[i];
				var newDist = edge.target.dist;
				annotations = [];
				annotations.push(makeStepAnnotation(edge));
				if (isTense(edge)) {
					newDist = relax(edge);
					addToPath(edge);
					if (edge.target.id === target.id) {
						curDist = newDist;
					}
					if (edge.target.pqHandle) {
						pq.changeKey(edge.target.pqHandle, newDist);
					} else {
						edge.target.pqHandle = pq.push(edge.target, newDist);
					}
				}
				annotations.push(makeShortestPathAnnotation(curDist));
				graph.links[edge.id].addStatus("visiting");
				tracePath(edge.target, {addStatus: "active"});
				recordStep(graph, annotations);
			}
		}
	}
});


app.registerAlgorithm({
	id: "bellman-ford",
	title: "Bellman-Ford (double for-loop)",
	code: function() {
		var source = getSource();
		var target = getTarget();
		addNodeClass(source.id, "source");
		addNodeClass(target.id, "target");
		var V = graph.V();
		var E = graph.E();
		initializeDistances(graph, source.id);
		var edgeTo = {};
		var curDist = graph.nodes[target.id].dist;
		var annotations = [makeStepAnnotation(null, {text: ""}), makeShortestPathAnnotation(curDist)];
		initializeAnnotations(annotations);
		for (var i = 0; i < V; ++i) {
			_.each(graph.links, function(edge) {
				annotations = [];
				annotations.push(makeStepAnnotation(edge));
				if (isTense(edge)) {
					var newDist = relax(edge);
					addToPath(edge);
					if (edge.target.id === target.id) {
						curDist = newDist;
					}
				}
				annotations.push(makeShortestPathAnnotation(curDist));
				graph.links[edge.id].addStatus("visiting");
				tracePath(edge.target, {addStatus: "active"});
				recordStep(graph, annotations);
			});
		}
	}
});

app.registerAlgorithm({
	id: "toposort",
	title: "Relaxing edges in topological order",
	code: function() {
		var	topoSort = function(graph, startId) {
			var sorted = [];
			var dfs = function(fromNode) {
				if (fromNode.marked) { return; }
				fromNode.marked = true;
				for (var i = 0; i < fromNode.adj.length; i++) {
					dfs(fromNode.adj[i].target);
				}
				sorted.push(fromNode);
			};
			dfs(graph.nodes[startId]);
			sorted.reverse();
			return sorted;
		};

		var source = getSource();
		var target = getTarget();
		initializeDistances(graph, source.id);
		addNodeClass(source.id, "source");
		addNodeClass(target.id, "target");

		var edgeTo = {};

		var curDist = graph.nodes[target.id].dist;
		var topoNodes = topoSort(graph, source.id);
		var annotations = [makeStepAnnotation(null, {text: ""}), makeShortestPathAnnotation(curDist)];
		initializeAnnotations(annotations);

		for (var i = 0; i < topoNodes.length; i++) {
			var node = topoNodes[i];
			if (node.id === target.id) {
				console.log("node " + node.id + " is target; aborting");
				return;
			}
			_.each(node.adj, function(edge) {
				var newDist = edge.target.dist;
				// annotations[0] = makeStepAnnotation(edge);
				annotations = [];
				annotations.push(makeStepAnnotation(edge));
				if (isTense(edge)) {
					newDist = relax(edge);
					if (edge.target.id === target.id) {
						curDist = newDist;
					}
					addToPath(edge);
				}
				// annotations[1] = makeShortestPathAnnotation(curDist);
				annotations.push(makeShortestPathAnnotation(curDist));
				tracePath(edge.target, {addStatus: "active"});
				recordStep(graph, annotations);
				console.log("recording step w/ path " + annotations[1].text);
			});
		}
	}
});

app.registerAlgorithm({
	id: "dfs",
	title: "DFS",
	code: function() {
		var source = getSource();
		addNodeClass(source.id, "source");
		var edgeTo = {};
		var curPath = [];
		dfs = function(start) {
			console.log("running DFS on " + start.id);
			if (!start.marked) {
				start.marked = true;
				start.addStickyStatus("exploring");
				start.addStatus("visiting");
				recordStep(graph, []);
			} else {
				recordStep(graph, []);
				console.log("vtx " + start.id + " already marked");
				return;
			}
			for (var i = 0; i < start.adj.length; i++) {
				var edge = start.adj[i];
				graph.addToPath(edge);
				graph.tracePath(edge.target, {addStatus: "active"});
				dfs(edge.target);
			}
			start.removeStickyStatus("exploring");
			start.addStickyStatus("finished");
			recordStep(graph, []);
		};
		_(graph.nodes).each(function(x) { x.marked = false; });
		dfs(source);
	}
});
