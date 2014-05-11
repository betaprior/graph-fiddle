var app = app || {}; // The Application

app.PlayPauseButton = Backbone.View.extend({
	tagName: "a",
	template: '<span class="fa fa-play"></span> <span class="mylabel">Run</span>',
	initialize: function() {
		this.model.set("status", "new");
		this.model.on('change:status', this.render, this);
	},
	render: function(){
		this.$el.html(this.template);
		this.$el.addClass("btn btn-default");
		this.$("span.fa").removeClass("fa-play fa-pause");
		this.$("span.fa").addClass('fa-' + (this.isPlaying() ? 'pause' : 'play'));
		this.$("span.mylabel").text(this.isPlaying() ? " Pause" : " Run");
	},
	events: {
		'click': function(){
			this.model.set('status', this.isPlaying() ? 'paused' : 'playing');
		}
	},
	isPlaying: function(){
		return this.model.get('status') === 'playing';
	}
});

app.GraphControlsView = Backbone.View.extend({
	el: "#spinner-form-group",
	template: '\
	    <label>Number of vertices:</label>\
    <div class="input-group spinner">\
    <input type="text" class="form-control" value="6">\
      <div class="input-group-btn-vertical">\
        <button class="btn btn-default"><i class="fa fa-caret-up"></i></button>\
        <button class="btn btn-default"><i class="fa fa-caret-down"></i></button>\
      </div>\
    </div>\
	',

	// template: 'Number of vertices: <input type="text" id="spinner" value="6" style="width: 80px;" />',
	_bindSpinnerArrows: function() {
		var $spinner = this.$(".spinner input");
		// need to return false from handlers, otherwise bootstrap
		// will try to submit the form and reload the page
		$(".spinner .btn:first-of-type").on("click", function() {
			if (this._getVal() < this.max) {
				$spinner.val(this._getVal() + 1);
				this.model.set("V", this._getVal());
			}
			return false;
		}.bind(this));
		$(".spinner .btn:last-of-type").on("click", function() {
			if (this._getVal() > this.min) {
				$spinner.val(this._getVal() - 1);
				this.model.set("V", this._getVal());
			}
			return false;
		}.bind(this));
	},
	_initSpinner: function() {
		this._bindSpinnerArrows();
		var that = this;
		$("input").change(function() {
			if ($(this).val().match(/^\d+$/)) {
				var v = that._getVal();
				if (v >= that.min && v <= that.max) {
					that.model.set("V", v);
					return;
				}
			}
			that.$spinner.val(that.model.get("V"));
		});
	},
	_getVal: function() {
		return parseInt(this.$spinner.val(), 10);
	},
	initialize: function(options) {
		options = options || {};
		this.animationModels = options.animationModels;
		this.min = 2;
		this.max = options.max || 100;
		this.defaultV = 4;
		Backbone.View.prototype.initialize.apply(this, arguments);
		if (!this.model.has("V")) {
			this.model.set("V", this.defaultV);
		}
		var playingStateHandler = function(model, val, options) {
			if (model.get("status") === "playing") {
				$("input, .spinner .btn:first-of-type, .spinner .btn:last-of-type")
					.prop("disabled", true);
			} else {
				$("input, .spinner .btn:first-of-type, .spinner .btn:last-of-type")
					.prop("disabled", false);
			}
		}.bind(this);

		this.listenTo(this.animationModels, "change", playingStateHandler);
	},
	render: function() {
		this.$el.html(this.template);
		this.$spinner = this.$(".spinner input");
		this._initSpinner();
		this.$spinner.val(this.model.get("V"));
		return this;
	}
});

app.AnimationControlView = Backbone.View.extend({
	template: '<a id="play" class="btn btn-default"><span class="fa fa-play"></span> <span class="mylabel">Run</span></a><a id="step-back" class="btn btn-default"><span class="fa fa-step-backward"></span></a><a id="step-fwd" class="btn btn-default"><span class="fa fa-step-forward"></span></a>',
	initialize: function(options) {
		this.options = options || {};
		this.model.set("status", "new");
		this.model.on('change:status', this.render, this);
		Backbone.View.prototype.initialize.apply(this, arguments);
	},
	_selectivelyDisplayControls: function() {
		if (this.options.showOnly) {
			this.$(".btn").css("display", "none");
			_.each(this.options.showOnly, function(id) {
				this.$("#" + id).css("display", "");
			}.bind(this));
		}
	},
	render: function(){
		this.$el.html(this.template);
		this._selectivelyDisplayControls();
		this.$("span.fa").removeClass("fa-play fa-pause");
		this.$("#play span.fa").addClass('fa-' + (this.isPlaying() ? 'pause' : 'play'));
		this.$("span.mylabel").text(this.isPlaying() ? " Pause" : " Run");
	},
	events: {
		'click a#play': function() {
			this.model.set("status", this.isPlaying() ? "paused" : "playing");
		},
		'click a#step-fwd': function() {
			this.model.set("req_steps", 1);
		},
		'click a#step-back': function() {
			this.model.set("req_steps", -1);
		}
	},
	isPlaying: function(){
		return this.model.get('status') === 'playing';
	}
});

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



app.DijkstraView = app.GraphSimulationView.extend({
	initialize: function() {
		app.GraphSimulationView.prototype.initialize.apply(this, arguments);
	},
	render: function() {
		this.renderGraph(this.model.graph);
		this.runDijkstraViz(this.source, this.target);
		return this;
	},
	runDijkstraViz: function(source, target) {
		var graph = this.model.graph;
		this.actions = [];
		this.initializeDistViz(graph, source);
		var edgeTo = {};
		var pq = makeIndexedPQ();
		var node = graph.nodes[source];
		node.pqHandle = pq.push(node, node.dist);
		while (!pq.isEmpty()) {
			var curNode = pq.deleteMin();
			curNode.pqHandle = null;
			for (var i = 0; i < curNode.adj.length; i++) {
				// var edge = graph.links[curNode.adj[i]];
				var edge = curNode.adj[i];
				var newDist = edge.target.dist;
				var step = {edge: edge, sourceDist: edge.source.dist, newDist: newDist,
							oldDist: edge.target.dist,
							curDist: graph.nodes[this.target].dist, relaxing: false};
				if (this.isTense(edge)) {
					step.relaxing = true;
					step.debug = "relax : " + edge.target.dist + " > " + edge.source.dist + " + " + edge.weight;
					newDist = this.relax(edge);
					step.newDist = newDist;
					edgeTo[edge.target.id] = edge;
					if (edge.target.pqHandle) {
						pq.changeKey(edge.target.pqHandle, newDist);
					} else {
						edge.target.pqHandle = pq.push(edge.target, newDist);
					}
				}
				step.curPath = this.constructPath(edge.target, edgeTo);
				this.actions.push(step);
			}
		}
	}
});

app.BellmanFordView = app.GraphSimulationView.extend({
	initialize: function() {
		app.GraphSimulationView.prototype.initialize.apply(this, arguments);
	},
	render: function() {
		this.renderGraph(this.model.graph);
		this.runBellmanFordViz(this.source, this.target);
		return this;
	},
	runBellmanFordViz: function(source, target) {
		var graph = this.model.graph;
		var V = this.model.V();
		var E = this.model.E();
		this.actions = [];
		this.initializeDistViz(graph, source);
		var edgeTo = {};
		for (var i = 0; i < V; ++i) {
			_.each(graph.links, function(edge) {
				var newDist = edge.target.dist;
				var step = {edge: edge, sourceDist: edge.source.dist, newDist: newDist,
							oldDist: edge.target.dist,
							curDist: graph.nodes[this.target].dist, relaxing: false};
				if (this.isTense(edge)) {
					step.relaxing = true;
					step.debug = "relax : + " +  edge.target.dist + " > " +  edge.source.dist + " + " + edge.weight;
					newDist = this.relax(edge);
					step.newDist = newDist;
					edgeTo[edge.target.id] = edge;
				}
				step.curPath = this.constructPath(edge.target, edgeTo);
				this.actions.push(step);
			}.bind(this));
		}
	}
});

app.TopoSortSsspView = app.GraphSimulationView.extend({
	initialize: function() {
		app.GraphSimulationView.prototype.initialize.apply(this, arguments);
	},
	render: function() {
		this.renderGraph(this.model.graph);
		this.runTopoSortSsspViz(this.source, this.target);
		return this;
	},
	topoSort: function(graph, startName) {
		var sorted = [];
		var dfs = function(fromNode) {
			if (fromNode.marked) { return; }
			fromNode.marked = true;
			for (var i = 0; i < fromNode.adj.length; i++) {
				dfs(fromNode.adj[i].target);
			}
			sorted.push(fromNode);
		};
		dfs(graph.nodes[startName]);
		sorted.reverse();
		return sorted;
	},
	runTopoSortSsspViz: function(source, target) {
		//TODO: this and elsewhere: remove source and target as fn arguments in favor of
		// instance variables
		var graph = this.model.graph;
		this.initializeDistViz(graph, source);
		this.actions = [];
		var edgeTo = {};
		var topoNodes = this.topoSort(graph, this.source);
		_.each(topoNodes, function(node) {
			_.each(node.adj, function(edge) {
				var newDist = edge.target.dist;
				var step = {edge: edge, sourceDist: edge.source.dist, newDist: newDist,
							oldDist: edge.target.dist,
							curDist: graph.nodes[this.target].dist, relaxing: false};
				if (this.isTense(edge)) {
					step.relaxing = true;
					step.debug = "relax : + " +  edge.target.dist + " > " +  edge.source.dist + " + " + edge.weight;
					newDist = this.relax(edge);
					step.newDist = newDist;
					edgeTo[edge.target.id] = edge;
				}
				step.curPath = this.constructPath(edge.target, edgeTo);
				this.actions.push(step);
			}.bind(this));
		}.bind(this));
	}
});

app.AlgoView = Backbone.View.extend({
	initialize: function(options) {
		options = options || {};
		var algo = options.algorithm;
		var AlgoView;
		var viewMap = {"dijkstra": app.DijkstraView,
					   "bellman-ford": app.BellmanFordView,
					   "toposort": app.TopoSortSsspView};
		if (!_.has(viewMap, algo)) {
			throw new Error("Invalid algorithm name");
		} else {
			AlgoView = viewMap[algo];
		}
		options.title = options.title || "";
		this.$(".algo-container").attr('data-content', options.title);
		this.animationControlsModel = options.animationControlsModel;
		this.masterAnimationControlsModel = options.masterAnimationControlsModel;
		this.graphModel = options.graphModel || new app.GraphModel({V: 6});
		this.playButton = new app.AnimationControlView({model: this.animationControlsModel});
		this.graphView  = new AlgoView({model: this.graphModel,
										animationModel: this.animationControlsModel});
	},
	render: function() {
		this.$(".animation-controls-container").append(this.playButton.$el);
		this.playButton.render();
		this.$(".graph-container").append(this.graphView.$el);
		this.graphView.render();
		return this;
	}
});

app.MasterControlsView = Backbone.View.extend({
	initialize: function(options) {
		this.animationModels = options.animationModels;
		this.masterAnimationControlsModel = options.masterAnimationControlsModel;
		this.graphControls = new app.GraphControlsView({
			el: "#spinner-form-group",
			model: options.masterGraphModel,
			animationModels: options.animationModels
		});
		this.masterAnimationControls = new app.AnimationControlView({
			el: "#play-controls-form-group",
			model: options.masterAnimationControlsModel,
			showOnly: ["play"]
		});
		this.listenTo(this.animationModels, "change:status", this.stateHandler);
		this.listenTo(this.masterAnimationControlsModel, "change:status", this.masterStateHandler);
	},
	allStopped: function() {
			return this.animationModels.every(function(m) {
				return m.get("status") !== "playing";
			});
	},
	allFinished: function() {
			return this.animationModels.every(function(m) {
				return m.get("status") === "finished";
			});
	},
	masterStateHandler: function(model, val, options) {
		var masterStatus = this.masterAnimationControlsModel.get("status");
		if (masterStatus === "paused" && this.allStopped()) {
			// console.log("Change trigger: master state is changed to paused but everything is stopped; ignoring");
		} else if (masterStatus === "playing" && this.allFinished()) {
			this.animationModels.each(function(model) {
				model.set("status", masterStatus);
			});
		} else {
			this.animationModels.each(function(model) {
				var status = model.get("status");
				if (status !== "finished") {
					// console.log("Setting status of model " + model.cid + " from " + status + " to " + masterStatus);
					model.set("status", masterStatus);
				}
			});
		}
	},
	stateHandler: function(model, val, options) {
		// console.log("Handling state change of model " + model.cid + " from " + model.previous("status") + " to " + model.get("status"));
		if (model.get("status") !== "playing") {
			if (this.allStopped()) {
				console.log("Setting master status to paused");
				this.masterAnimationControls.model.set("status", "paused");
			}
		}
	},
	render: function() {
		this.graphControls.render();
		this.masterAnimationControls.render();
		return this;
	}
});

app.MainView = Backbone.View.extend({
	el: "#app-container",
	initialize: function() {
		var algos = ["dijkstra", "bellman-ford", "toposort"];
		var titles = {
			"dijkstra": "Dijkstra's algorithm",
			"bellman-ford": "Bellman-Ford (double for-loop)",
			"toposort": "Relaxing edges in topological order"
		};
		this.algoViews = [];
		var graphModels = new Backbone.Collection();
		var animationModels = new Backbone.Collection();
		var graphMasterModel = new app.GraphModel({V: 6});
		var masterAnimationControlsModel = new Backbone.Model({status: "paused"});
		this.masterControlsView = new app.MasterControlsView({
			masterGraphModel: graphMasterModel,
			masterAnimationControlsModel: masterAnimationControlsModel,
			animationModels: animationModels
		});
		_(algos).each(function(x) {
			var animationControlsModel = new Backbone.Model({status: "paused", req_steps: 0});
			var graphModel = new app.GraphModel({V: 6, masterModel: graphMasterModel});
			var view = new app.AlgoView({
				el: this.$("#" + x + "-container"), algorithm: x,
				animationControlsModel: animationControlsModel,
				masterAnimationControlsModel: masterAnimationControlsModel,
				graphModel: graphModel,
				title: titles[x]
			});
			this.algoViews.push(view);
			graphModels.add(graphModel);
			animationModels.add(animationControlsModel);
		}.bind(this));
	},
	render: function() {
		this.masterControlsView.render();
		_(this.algoViews).each(function(x) {
			x.render();
		});
		// this.$("#graph-controls-container").append(this.graphControls.$el);
		// this.$("#graph-controls-container").append(this.masterAnimationControls.$el);
		// this.$("#animation-controls-container").append(this.playButton.$el);
		// this.playButton.render();
		// this.$("#dijkstra-container").append(this.graphView.$el);
		// this.$("#bellman-ford-container").append(this.graphView2.$el);
		// this.graphView.render();
		// this.graphView2.render();
		return this;
	}
});


$(document).ready(function () {
	var main = new app.MainView();
	main.render();
});
