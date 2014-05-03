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
	template: 'Number of vertices: \
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
		$(".spinner .btn:first-of-type").on("click", function() {
			if (this._getVal() < this.max) {
				$spinner.val(this._getVal() + 1);
				this.model.set("V", this._getVal());
			}
		}.bind(this));
		$(".spinner .btn:last-of-type").on("click", function() {
			if (this._getVal() > this.min) {
				$spinner.val(this._getVal() - 1);
				this.model.set("V", this._getVal());
			}
		}.bind(this));
	},
	_disableSpinnerArrows: function() {
		$(".spinner .btn:first-of-type").off("click");
		$(".spinner .btn:last-of-type").off("click");
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
				$("input").prop("disabled", true);
				this._disableSpinnerArrows();
			} else {
				$("input").prop("disabled", false);
				this._bindSpinnerArrows();
			}
		}.bind(this);

		this.listenTo(this.animationModels, "change", playingStateHandler);
	},
	render: function() {
		this.$el.html(this.template);
		this.$spinner = this.$(".spinner input");
		this._initSpinner();
		this.$spinner.val(this.model.get("V"));
	}
});

app.AnimationControlView = Backbone.View.extend({
	template: '<a id="play" class="btn btn-default"><span class="fa fa-play"></span> <span class="mylabel">Run</span></a><a id="step-back" class="btn btn-default"><span class="fa fa-step-backward"></span></a><a id="step-fwd" class="btn btn-default"><span class="fa fa-step-forward"></span></a>',
	initialize: function() {
		this.model.set("status", "new");
		this.model.on('change:status', this.render, this);
		Backbone.View.prototype.initialize.apply(this, arguments);
	},
	render: function(){
		this.$el.html(this.template);
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
	initialize: function(options) {
		options = options || {};
		this.source = options.source || "0";
		this.target = options.target || "1";
		this.animationModel = options.animationModel;
		this.next_step = 0;
		this._registerEvents();
		// this.model.on("change:V", function() {
		// 	debugger;
		// });
		app.GraphView.prototype.initialize.apply(this, arguments);
		// this.run = function() { console.log("I should be redefined at this point"); };
	},
	_registerEvents: function() {
		this.listenTo(this.model, "change:V", function() {
			this.model.makeWorstCaseDijkstra(this.model.get("V"));
			this.render();
		}.bind(this));
		this.animationModel.on("change:status", function() {
			if (this.animationModel.get("status") === "playing") {
				var ps = this.animationModel.previous("status");
				if (ps === "new" || ps === "finished") {
					this.initializeDistViz(this.model.graph, this.source);
					this.next_step = 0;
				}
				this.runActions(this.next_step);
			}
		}.bind(this), this);
		this.animationModel.on("change:req_steps", function() {
			if (this.animationModel.get("req_steps") === 0) { return; }
			// TODO: change this behavior so that hitting "step fwd" at the end
			// of the simulation is a no-op (or finalizes the simulation)
			// TODO: hitting "step back" at the beginning resets simulation
			if (this.animationModel.get("status") === "finished" && this.animationModel.get("req_steps") === 1) {
				this.initializeDistViz(graph, this.source);
				this.next_step = 0;
			}
			this.animationModel.set("status", "paused");
			this.runStep(this.next_step - 1 + this.animationModel.get("req_steps"));
			this.animationModel.set("req_steps", 0);
		}.bind(this), this);
	},
	render: function() {
		this.renderGraph(this.model.graph);
		this.runDijkstraViz(this.source, this.target);
		return this;
	},
	runDijkstraViz: function(source, target) {
		var graph = this.model.graph;
		this.initializeDistViz(graph, source);
		this.timeout = 1000;
		var actions = [];
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
					step.debug = "relax : + " +  edge.target.dist + " > " +  edge.source.dist + " + " + edge.weight;
					newDist = this.relax(edge);
					step.newDist = newDist;
					edgeTo[edge.target.name] = edge;
					step.curPath = constructPath(edge.target);
					if (edge.target.pqHandle) {
						pq.changeKey(edge.target.pqHandle, newDist);
					} else {
						edge.target.pqHandle = pq.push(edge.target, newDist);
					}
				}
				actions.push(step);
				this.actions = actions;
			}
		}
		function constructPath(t) {
			var path = [], edge;
			while ((edge = edgeTo[t.name])) {
				path.push(edge);
				t = edge.source;
			}
			path.reverse();
			return path;
		}


	}
});

app.AlgoView = Backbone.View.extend({
	initialize: function(options) {
		options = options || {};
		var algo = options.algorithm;
		var AlgoView;
		var viewMap = {"dijkstra": app.DijkstraView,
					   "bellman-ford": app.DijkstraView,
					   "toposort": app.DijkstraView};
		if (!_.has(viewMap, algo)) {
			throw new Error("Invalid algorithm name");
		} else {
			AlgoView = viewMap[algo];
		}
		this.animationControlsModel = options.animationControlsModel || new Backbone.Model({status: "paused", req_steps: 0});
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

app.MainView = Backbone.View.extend({
	el: "#app-container",
	initialize: function() {
		var algos = ["dijkstra", "bellman-ford"];
		this.algoViews = [];
		var graphModels = new Backbone.Collection();
		var animationModels = new Backbone.Collection();
		var graphMasterModel = new app.GraphModel({V: 6});
		_(algos).each(function(x) {
			var animationControlsModel = new Backbone.Model({status: "paused", req_steps: 0});
			var graphModel = new app.GraphModel({V: 6, masterModel: graphMasterModel});
			var view = new app.AlgoView({el: this.$("#" + x + "-container"), algorithm: x,
										 animationControlsModel: animationControlsModel,
										 graphModel: graphModel});
			this.algoViews.push(view);
			graphModels.add(graphModel);
			animationModels.add(animationControlsModel);
		}.bind(this));

		this.graphControls = new app.GraphControlsView({model: graphMasterModel,
														animationModels: animationModels});

	},
	render: function() {
		_(this.algoViews).each(function(x) {
			x.render();
		});
		this.$("#graph-controls-container").append(this.graphControls.$el);
		this.graphControls.render();
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
