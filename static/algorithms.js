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
		this.renderGraph(this.model.graph);
		this.resetStatus(this.model.graph);
		this.recordAnimatedAlgorithm(this.model.graph, this.source, this.target);
		return this;
	}
});


app.DijkstraView = app.AnimatedSimulationBase.extend({
/* BEGIN ALGORITHM dijkstra */
	recordAnimatedAlgorithm: function(graph, source, target) {
		this.initializeDistances(graph, source.id);
		this.addNodeClass(source.id, "source");
		this.addNodeClass(target.id, "target");

		var edgeTo = {};
		var curDist = graph.nodes[this.target.id].dist;
		var annotations = [this.makeStepAnnotation(null, {text: ""}), this.makeShortestPathAnnotation(curDist)];
		this.initializeAnnotations(annotations);
		var pq = makeIndexedPQ();
		var node = graph.nodes[source.id];
		node.pqHandle = pq.push(node, node.dist);
		while (!pq.isEmpty()) {
			var curNode = pq.deleteMin();
			curNode.pqHandle = null;
			for (var i = 0; i < curNode.adj.length; i++) {
				var edge = curNode.adj[i];
				var newDist = edge.target.dist;
				annotations = [];
				annotations.push(this.makeStepAnnotation(edge));
				if (this.isTense(edge)) {
					newDist = this.relax(edge);
					edgeTo[edge.target.id] = edge;
					if (edge.target.pqHandle) {
						pq.changeKey(edge.target.pqHandle, newDist);
					} else {
						edge.target.pqHandle = pq.push(edge.target, newDist);
					}
					if (edge.target.id === this.target.id) {
						curDist = newDist;
					}
				}
				annotations.push(this.makeShortestPathAnnotation(curDist));
				graph.links[edge.id].addStatus("visiting");
				var curPath = this.constructPath(edge.target, edgeTo);
				_(curPath).each(function(link) {
					graph.links[link.id].addStatus("active");
				});
				this.recordStep(graph, annotations);
			}
		}
	}
/* END ALGORITHM */
});

app.BellmanFordView = app.AnimatedSimulationBase.extend({
/* BEGIN ALGORITHM bellman-ford */
	recordAnimatedAlgorithm: function(graph, source, target) {
		this.addNodeClass(source.id, "source");
		this.addNodeClass(target.id, "target");
		var V = this.model.V();
		var E = this.model.E();
		this.initializeDistances(graph, source.id);
		var edgeTo = {};
		var curDist = graph.nodes[this.target.id].dist;
		var annotations = [this.makeStepAnnotation(null, {text: ""}), this.makeShortestPathAnnotation(curDist)];
		this.initializeAnnotations(annotations);
		for (var i = 0; i < V; ++i) {
			_.each(graph.links, function(edge) {
				annotations = [];
				annotations.push(this.makeStepAnnotation(edge));
				if (this.isTense(edge)) {
					var newDist = this.relax(edge);
					edgeTo[edge.target.id] = edge;
					if (edge.target.id === this.target.id) {
						curDist = newDist;
					}
				}
				annotations.push(this.makeShortestPathAnnotation(curDist));
				var curPath = this.constructPath(edge.target, edgeTo);
				graph.links[edge.id].addStatus("visiting");
				_(curPath).each(function(link) {
					graph.links[link.id].addStatus("active");
				});
				this.recordStep(graph, annotations);
			}.bind(this));
		}
	}
/* END ALGORITHM */
});

app.TopoSortSsspView = app.AnimatedSimulationBase.extend({
/* BEGIN ALGORITHM toposort */
	recordAnimatedAlgorithm: function(graph, source, target) {
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

		this.initializeDistances(graph, source.id);
		var edgeTo = {};

		var curDist = graph.nodes[this.target.id].dist;
		var topoNodes = topoSort(graph, this.source.id);
		var annotations = [this.makeStepAnnotation(null, {text: ""}), this.makeShortestPathAnnotation(curDist)];
		this.initializeAnnotations(annotations);

		_.each(topoNodes, function(node) {
			_.each(node.adj, function(edge) {
				var newDist = edge.target.dist;
				// annotations[0] = this.makeStepAnnotation(edge);
				annotations = [];
				annotations.push(this.makeStepAnnotation(edge));
				if (this.isTense(edge)) {
					newDist = this.relax(edge);
					if (edge.target.id === this.target.id) {
						curDist = newDist;
					}
					edgeTo[edge.target.id] = edge;
				}
				// annotations[1] = this.makeShortestPathAnnotation(curDist);
				annotations.push(this.makeShortestPathAnnotation(curDist));
				var curPath = this.constructPath(edge.target, edgeTo);
				_(curPath).each(function(link) {
					graph.links[link.id].addStatus("active");
				});
				this.recordStep(graph, annotations);
				console.log("recording step w/ path " + annotations[1].text);
			}.bind(this));
		}.bind(this));
	}
/* END ALGORITHM */
});
