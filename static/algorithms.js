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


app.DijkstraView = app.AnimatedSimulationBase.extend({
/* BEGIN ALGORITHM dijkstra */
	recordAnimatedAlgorithm: function(graph) {
		var source = this.getSource();
		var target = this.getTarget();
		this.initializeDistances(graph, source.id);
		this.addNodeClass(source.id, "source");
		this.addNodeClass(target.id, "target");

		var edgeTo = {};
		var curDist = graph.nodes[target.id].dist;
		var annotations = [this.makeStepAnnotation(null, {text: ""}), this.makeShortestPathAnnotation(curDist)];
		this.initializeAnnotations(annotations);
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
				annotations.push(this.makeStepAnnotation(edge));
				if (this.isTense(edge)) {
					newDist = this.relax(edge);
					this.addToPath(edge);
					if (edge.target.id === target.id) {
						curDist = newDist;
					}
					if (edge.target.pqHandle) {
						pq.changeKey(edge.target.pqHandle, newDist);
					} else {
						edge.target.pqHandle = pq.push(edge.target, newDist);
					}
				}
				annotations.push(this.makeShortestPathAnnotation(curDist));
				graph.links[edge.id].addStatus("visiting");
				this.tracePath(edge.target, {addStatus: "active"});
				this.recordStep(graph, annotations);
			}
		}
	}
/* END ALGORITHM */
});

app.BellmanFordView = app.AnimatedSimulationBase.extend({
/* BEGIN ALGORITHM bellman-ford */
	recordAnimatedAlgorithm: function(graph) {
		var source = this.getSource();
		var target = this.getTarget();
		this.addNodeClass(source.id, "source");
		this.addNodeClass(target.id, "target");
		var V = this.model.V();
		var E = this.model.E();
		this.initializeDistances(graph, source.id);
		var edgeTo = {};
		var curDist = graph.nodes[target.id].dist;
		var annotations = [this.makeStepAnnotation(null, {text: ""}), this.makeShortestPathAnnotation(curDist)];
		this.initializeAnnotations(annotations);
		for (var i = 0; i < V; ++i) {
			_.each(graph.links, function(edge) {
				annotations = [];
				annotations.push(this.makeStepAnnotation(edge));
				if (this.isTense(edge)) {
					var newDist = this.relax(edge);
					this.addToPath(edge);
					if (edge.target.id === target.id) {
						curDist = newDist;
					}
				}
				annotations.push(this.makeShortestPathAnnotation(curDist));
				graph.links[edge.id].addStatus("visiting");
				this.tracePath(edge.target, {addStatus: "active"});
				this.recordStep(graph, annotations);
			}.bind(this));
		}
	}
/* END ALGORITHM */
});

app.TopoSortSsspView = app.AnimatedSimulationBase.extend({
/* BEGIN ALGORITHM toposort */
	recordAnimatedAlgorithm: function(graph) {
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

		var source = this.getSource();
		var target = this.getTarget();
		this.initializeDistances(graph, source.id);
		this.addNodeClass(source.id, "source");
		this.addNodeClass(target.id, "target");

		var edgeTo = {};

		var curDist = graph.nodes[target.id].dist;
		var topoNodes = topoSort(graph, source.id);
		var annotations = [this.makeStepAnnotation(null, {text: ""}), this.makeShortestPathAnnotation(curDist)];
		this.initializeAnnotations(annotations);

		for (var i = 0; i < topoNodes.length; i++) {
			var node = topoNodes[i];
			if (node.id === target.id) {
				console.log("node " + node.id + " is target; aborting");
				return;
			}
			_.each(node.adj, function(edge) {
				var newDist = edge.target.dist;
				// annotations[0] = this.makeStepAnnotation(edge);
				annotations = [];
				annotations.push(this.makeStepAnnotation(edge));
				if (this.isTense(edge)) {
					newDist = this.relax(edge);
					if (edge.target.id === target.id) {
						curDist = newDist;
					}
					this.addToPath(edge);
				}
				// annotations[1] = this.makeShortestPathAnnotation(curDist);
				annotations.push(this.makeShortestPathAnnotation(curDist));
				this.tracePath(edge.target, {addStatus: "active"});
				this.recordStep(graph, annotations);
				console.log("recording step w/ path " + annotations[1].text);
			}.bind(this));
		}
	}
/* END ALGORITHM */
});
