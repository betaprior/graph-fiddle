var app = app || {};

app.GraphSimulationView = app.GraphView.extend({

	initialize: function(options) {
		options = options || {};
		this.source = options.source || "0";
		this.target = options.target || "1";
		this.timeout = options.timeout || 1000;
		this.animationModel = options.animationModel;
		this.next_step = 0;
		this.actions = [];
		this._registerEvents();
		app.GraphView.prototype.initialize.apply(this, arguments);
	},

	_registerEvents: function() {
		this.listenTo(this.model, "change:V", function() {
			this.model.makeWorstCaseDijkstra(this.model.get("V"));
			this.actions = [];
			this.next_step = 0;
			this.render();
		});
		this.listenTo(this.animationModel, "change:status", function() {
			if (this.animationModel.get("status") === "playing") {
				var ps = this.animationModel.previous("status");
				if (ps === "new" || ps === "finished") {
					this.initializeDistViz(this.model.graph, this.source);
					this.next_step = 0;
				}
				this.runActions(this.next_step);
			}
		});
		this.listenTo(this.animationModel, "change:req_steps", function() {
			if (this.animationModel.get("req_steps") === 0) { return; }
			// TODO: change this behavior so that hitting "step fwd" at the end
			// of the simulation is a no-op (or finalizes the simulation)
			// TODO: hitting "step back" at the beginning resets simulation
			if (this.animationModel.get("status") === "finished" && this.animationModel.get("req_steps") === 1) {
				this.initializeDistViz(this.model.graph, this.source);
				this.next_step = 0;
			}
			this.animationModel.set("status", "paused");
			this.runStep(this.next_step - 1 + this.animationModel.get("req_steps"));
			this.animationModel.set("req_steps", 0);
		});
	},

	showNodeDist: function(step, options) {
		options = options || {};
		var cls = options.cls;
		var node = step.edge.target;
		var dist = step.newDist;
		var oldDist = step.oldDist;
		var d3el = this.d3el;
		var sel = d3el.selectAll("#node" + node.name).select("text");
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
	},

	// This creates the text spans for node distance text; as such, this
	// must be run before any distance labels can be updated using showNodeDist.
	// Creating HTML should probably be delegated to some other function eventually.
	displayAllDistances: function(options) {
		options = options || {};
		var d3nodes = this.d3el.selectAll("[id^=node]");
		if (d3nodes.select("tspan#new").empty()) {
			var d3text = d3nodes.select("text");
			d3text.append("tspan").attr("id", "old");
			d3text.append("tspan").attr({"id": "spc", "xml:space": "preserve"});
			d3text.append("tspan").attr("id", "new");
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
	},

	deselectAll: function() {
		this.d3el.selectAll("[id^=link]").classed("visiting", false);
		this.d3el.selectAll("text.dist").classed("relaxing", false);
	},

	initializeDistViz: function(graph, source) {
		_(graph.nodes).each(function(x) {
			x.dist = Infinity;
		});
		graph.nodes[source].dist = 0;
		this.displayAllDistances({fromData: true});
	},

	isTense: function(edge) {
		return edge.target.dist > edge.source.dist + edge.weight;
	},

	relax: function(edge) {
		edge.target.dist = edge.source.dist + edge.weight;
		return edge.target.dist;
	},

	pathToString: function(path) {
		var sbuf = [];
		_(path).each(function(x) {
			sbuf.push(x.source.name + "->" + x.target.name + ";");
		});
		return sbuf.join(" ");
	},

	constructPath: function(startNode, edgeTo) {
		var path = [], edge;
		while ((edge = edgeTo[startNode.name])) {
			path.push(edge);
			startNode = edge.source;
		}
		path.reverse();
		return path;
	},

	vizStep: function(step) {
		var graph = this.model.graph;
		this.updateSteps(this.next_step);
		// this.updateDist(step.curDist);
		console.log(step.debug);
		console.log(graph.nodes[this.target]);
		var d3el = this.d3el;
		d3el.selectAll("[id^=link]").classed("visiting", false);
		d3el.selectAll("[id^=node]").classed("visiting", false);
		d3el.selectAll("[id^=link]").attr("marker-end", "url(#end)");
		d3el.selectAll("text.dist").classed("relaxing", false);
		// d3el.selectAll("text.dist > tspan#old").text("");
		this.displayAllDistances();
		d3el.selectAll("#link" + step.edge.id).classed("visiting", true);
		var curNode = d3el.selectAll("#node" + step.edge.target.name);
		curNode.classed("visiting", true);

		// highlight currently active path:
		d3el.selectAll("[id^=link]").classed("active", false);
		_(step.curPath).each(function(edge) {
			d3el.selectAll("#link" + edge.id).classed("active", true);
			d3el.selectAll("#link" + edge.id).attr("marker-end", "url(#end-active)");
		});
		if (step.relaxing) {
			this.updateOp(step.sourceDist + " + " + step.edge.weight + " < " + step.oldDist,
						  {fill: "green"});
			if (step.edge.target.name === this.target) {
				this.updateDist(step.newDist);
			}
			this.showNodeDist(step, {cls: "relaxing", showOld: true});
			console.log(this.pathToString(step.curPath));
		} else {
			this.updateOp(step.sourceDist + " + " + step.edge.weight + " >= " + step.newDist,
						  {fill: "red"});
		}
	},

	runStep: function(i) {
		// bound the allowed steps
		if (i >= this.actions.length) {
			i = this.actions.length - 1;
		} else if (i < 0) {
			i = 0;
		}
		this.next_step = i + 1;
		this.vizStep(this.actions[i]);
		if (i === this.actions.length - 1) {
			this.animationModel.set("status", "finished");
			// setTimeout(this.deselectAll, this.timeout);
		}
	},

	runActions: function(i) {
		if (this.animationModel.get("status") !== "playing") { return; }
		i = i || 0;
		this.runStep(i);
		if (i < this.actions.length - 1) {
			setTimeout(function() { this.runActions(i+1); }.bind(this), this.timeout);
		}
	}



});
