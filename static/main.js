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
	_initSpinner: function() {
		var $spinner = this.$(".spinner input");
		$(".spinner .btn:first-of-type").on("click", function() {
			if (this.animationModel.get("status") === "playing") { return; }
			if (this._getVal() < this.max) {
				$spinner.val(this._getVal() + 1);
				this.model.set("V", this._getVal());
			}
		}.bind(this));
		$(".spinner .btn:last-of-type").on("click", function() {
			if (this.animationModel.get("status") === "playing") { return; }
			if (this._getVal() > this.min) {
				$spinner.val(this._getVal() - 1);
				this.model.set("V", this._getVal());
			}
		}.bind(this));
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
		this.animationModel = options.animationModel;
		this.min = 2;
		this.max = options.max || 100;
		this.defaultV = 4;
		Backbone.View.prototype.initialize.apply(this, arguments);
		if (!this.model.has("V")) {
			this.model.set("V", this.defaultV);
		}
		this.listenTo(this.animationModel, "change", function() {
			if (this.animationModel.get("status") === "playing") {
				$("input").prop("disabled", true);
			} else {
				$("input").prop("disabled", false);
			}
		});
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

function showNodeDist(step, options) {
	options = options || {};
	var cls = options.cls;
	var node = step.edge.target;
	var dist = step.newDist;
	var oldDist = step.oldDist;
	var sel = d3.selectAll("#node" + node.name).select("text");
	if (dist === null) {
		dist = sel.datum().dist;
	}
	var oldText = "";
	if (options.showOld && oldDist !== void 0) {
		oldText = oldDist === Infinity ? '∞' : String(oldDist);
	}
	var spc = oldText && options.showOld ? ' ' : '';
	var newText = dist === Infinity ? '∞' : dist;
	sel.select("#old").text(oldText).attr("text-decoration", "line-through");
	sel.select("#spc").text(spc);
	sel.select("#new").text(newText);
	if (cls) { sel.select("#new").classed(cls, true); }
}

// This creates the text spans for node distance text; as such, this
// must be run before any distance labels can be updated using showNodeDist.
// Creating HTML should probably be delegated to some other function eventually.
function displayAllDistances(options) {
	options = options || {};
	var d3nodes = d3.selectAll("[id^=node]");
	if (d3nodes.select("tspan#new").empty()) {
		d3nodes.select("text").html('<tspan id="old"></tspan><tspan id="spc" xml:space="preserve"></tspan><tspan id="new"></tspan>');
	}
	var selNew = d3nodes.select("text > tspan#new");
	var selOld = d3nodes.select("text > tspan#old");

	selOld.text("");
	selNew.text(function(d) {
		if (options.fromData) {
			return d.dist === Infinity ? '∞' : d.dist;
		} else {
			return d3.select(this).text();
		}
	});
}

function initializeDistViz(graph, source) {
	_(graph.nodes).each(function(x) {
		x.dist = Infinity;
	});
	graph.nodes[source].dist = 0;
	displayAllDistances({fromData: true});
}

function isTense(edge) {
	return edge.target.dist > edge.source.dist + edge.weight;
}

function relax(edge) {
	edge.target.dist = edge.source.dist + edge.weight;
	return edge.target.dist;
}



app.DijkstraView = app.GraphView.extend({
	initialize: function(options) {
		options = options || {};
		this.source = options.source || "0";
		this.target = options.target || "1";
		this.animationModel = options.animationModel;
		this.next_step = 0;
		this.listenTo(this.model, "change:V", function() {
			this.model.makeWorstCaseDijkstra(this.model.get("V"));
			this.render();
		}.bind(this));
		// this.model.on("change:V", function() {
		// 	debugger;
		// });
		app.GraphView.prototype.initialize.apply(this, arguments);
		// this.run = function() { console.log("I should be redefined at this point"); };
	},
	render: function() {
		var graph = this.model.graph;
		this.renderGraph(graph);
		this.runDijkstraViz(graph, this.source, this.target);
		this.animationModel.on("change:status", function() {
			if (this.animationModel.get("status") === "playing") {
				var ps = this.animationModel.previous("status");
				if (ps === "new" || ps === "finished") {
					initializeDistViz(graph, this.source);
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
				initializeDistViz(graph, this.source);
				this.next_step = 0;
			}
			this.animationModel.set("status", "paused");
			this.runStep(this.next_step - 1 + this.animationModel.get("req_steps"));
			this.animationModel.set("req_steps", 0);
		}.bind(this), this);
		return this;
	},
	runDijkstraViz: function(graph, source, target) {
		initializeDistViz(graph, source);
		var actions = [];
		var edgeTo = {};
		var timeout = 1000;
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
				if (isTense(edge)) {
					step.relaxing = true;
					step.debug = "relax : + " +  edge.target.dist + " > " +  edge.source.dist + " + " + edge.weight;
					newDist = relax(edge);
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
		var pathToString = function(path) {
			var sbuf = [];
			_(path).each(function(x) {
				sbuf.push(x.source.name + "->" + x.target.name + ";");
			});
			return sbuf.join(" ");
		};
		var vizStep = function(step) {
			this.updateSteps(this.next_step);
			this.updateDist(step.curDist);
			console.log(step.debug);
			console.log(graph.nodes[this.target]);
			d3.selectAll("[id^=link]").classed("visiting", false);
			d3.selectAll("[id^=node]").classed("visiting", false);
			d3.selectAll("[id^=link]").attr("marker-end", "url(#end)");
			d3.selectAll("text.dist").classed("relaxing", false);
			// d3.selectAll("text.dist > tspan#old").text("");
			displayAllDistances();
			d3.selectAll("#link" + step.edge.id).classed("visiting", true);
			var curNode = d3.selectAll("#node" + step.edge.target.name);
			curNode.classed("visiting", true);
			// var curNodeText = curNode.selectAll("text.dist");
			// curNodeText.text(curNodeText.text() + "?");
			if (step.relaxing) {
				this.updateOp(step.sourceDist + " + " + step.edge.weight + " < " + step.oldDist,
							 {fill: "green"});
				d3.selectAll("[id^=link]").classed("active", false);
				showNodeDist(step, {cls: "relaxing", showOld: true});
				// highlight currently active path:
				_(step.curPath).each(function(edge) {
					d3.selectAll("#link" + edge.id).classed("active", true);
					d3.selectAll("#link" + edge.id).attr("marker-end", "url(#end-active)");

				});
				console.log(pathToString(step.curPath));
			} else {
				this.updateOp(step.newDist + " >= " + step.sourceDist + " + " + step.edge.weight,
							 {fill: "red"});
			}
		}.bind(this);

		var deselectAll = function() {
			d3.selectAll("[id^=link]").classed("visiting", false);
			d3.selectAll("text.dist").classed("relaxing", false);
		};

		var runStep = function(i) {
			// bound the allowed steps
			if (i >= actions.length) {
				i = actions.length - 1;
			} else if (i < 0) {
				i = 0;
			}
			this.next_step = i + 1;
			vizStep(actions[i]);
			if (i === actions.length - 1) {
				this.animationModel.set("status", "finished");
				// setTimeout(deselectAll, timeout);
			}
		}.bind(this);

		var runActions = function(i) {
			if (this.animationModel.get("status") !== "playing") { return; }
			i = i || 0;
			runStep(i);
			if (i < actions.length - 1) {
				setTimeout(function() { runActions(i+1); }, timeout);
			}
		}.bind(this);

		this.runStep = runStep;
		this.runActions = runActions;
	}
});

app.MainView = Backbone.View.extend({
	el: "#app-container",
	initialize: function() {
		this.animationControlsModel = new Backbone.Model({status: "paused", req_steps: 0});
		this.graphModel = new app.GraphModel({V: 6});
		this.graphControls = new app.GraphControlsView({model: this.graphModel,
														animationModel: this.animationControlsModel});
		this.playButton = new app.AnimationControlView({model: this.animationControlsModel});
		this.graphView  = new app.DijkstraView({model: this.graphModel,
												animationModel: this.animationControlsModel});
	},
	render: function() {
		this.$("#graph-controls-container").append(this.graphControls.$el);
		this.graphControls.render();
		this.$("#animation-controls-container").append(this.playButton.$el);
		this.playButton.render();
		this.$("#algo-view-container").append(this.graphView.$el);
		this.graphView.render();
		return this;
	}
});


$(document).ready(function () {
	var main = new app.MainView();
	main.render();
});
