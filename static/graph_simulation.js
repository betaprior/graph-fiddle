var app = app || {};

/**
 *   Graph simulation class
 *
 *   Contains methods for creating and rendering graph traversal simulation animations.
 *
 *   Arguments:
 *   - animationModel
 */
app.GraphSimulationView = app.GraphView.extend({

	initialize: function(options) {
		options = options || {};
		this.setSource({id: options.sourceId || 0});
		this.setTarget({id: options.targetId || 1});
		this.timeout = options.timeout || 1000;
		this.animationModel = options.animationModel;
		this.next_step = 0;
		this.actions = [];
		this._registerEvents();
		app.GraphView.prototype.initialize.apply(this, arguments);
	},

	/**
	 *   Register events from control models.
	 */
	_registerEvents: function() {
		this.listenTo(this.model, "change:V", function() {
			// TODO: generalize to use any graph creation algorithm
			this.model.makeWorstCaseDijkstra(this.model.get("V"));
			this.actions = [];
			this.next_step = 0;
			this.render();
		});
		this.listenTo(this.animationModel, "change:status", function() {
			if (this.animationModel.get("status") === "playing") {
				var ps = this.animationModel.previous("status");
				if (ps === "new" || ps === "finished") {
					this.initializeDistances(this.model.graph);
					this.next_step = 0;
				}
				this.runActions(this.next_step);
			}
		});
		this.listenTo(this.animationModel, "change:req_steps", function() {
			if (this.animationModel.get("req_steps") === 0) { return; }
			// TODO: change this behavior so that hitting "step fwd" at the end
			// of the simulation is a no-op (or finalizes the simulation)
			// TODO: FIXME: hitting "step back" at the beginning should either reset the simulation
			// or loop to the last step (currently it goes to step 1)
			// if (this.animationModel.get("status") === "finished" && this.animationModel.get("req_steps") === 1) {
			// 	this.initializeDistances(this.model.graph);
			// 	this.next_step = 0;
			// }
			this.animationModel.set("status", "paused");
			this.runStep(this.next_step - 1 + this.animationModel.get("req_steps"));
			this.animationModel.set("req_steps", 0);
		});
	},

	/**
	 *   Source and target getters
	 */
	getSource: function() {
		return this.model.graph.nodes[this._sourceId];
	},
	getTarget: function() {
		return this.model.graph.nodes[this._targetId];
	},
	/**
	 *   Source and target setters. To keep setters and getters symmetric, they take node
	 *   elements as arguments, but only the ID is stored internally.  Alternatively,
	 *   {id: "foo"} hash may be passed in to give the ID explicitly.
	 */
	setSource: function(obj) {
		this._sourceId = obj.id;
	},
	setTarget: function(obj) {
		this._targetId = obj.id;
	},

	/**
	 *   Update distance annotations from step to step.  This function
	 *   shows the distances from source node as of the current step;
	 *   if a step updates a node's distance, the previous distance is shown
	 *   next to the new one (styled accodingly, e.g. with a strikethrough font).
	 */
	visualizeDistances: function(step, prevStep, options) {
		var d3el = this.d3el();
		d3el.selectAll(".node").select("text")
			.each(function(d) {
				var oldText = "";
				var spc = "";
				if (prevStep) {
					var prevDist = prevStep.graph.nodes[d.id].dist;
					oldText = prevDist === Infinity ? '∞' : String(prevDist);
				}
				var curDist = step.graph.nodes[d.id].dist;
				var curText = curDist === Infinity ? '∞' : String(curDist);
				if (options.showOld && oldText && oldText !== curText) {
					spc = " ";
					d3.select(this).select("#old").text(oldText).attr("text-decoration", "line-through");
				} else {
					d3.select(this).select("#old").text("");
				}
				d3.select(this).select("#spc").text(spc);
				d3.select(this).select("#new").text(curText);
				// if (options.cls) { d3.select(this).select("#new").classed(cls, true); }
			});
	},

	/**
	 *   This function prepares individual graph node text annotations. By default, the
	 *   center node text is an HTML text element with "node-text" class; depending on the
	 *   algorithm it can display various pieces of information.  For topological sort, for instance,
	 *   we could show the topological order of this node; for shortest-path finding algorithms
	 *   we'd like to show distance updates.
	 *
	 *   The purpose of this function is to create appropriate templates for node text elements
	 *   (probably comprised of a set of tspan elements) based on the use case
	 *   passed in the `options` object as options.template attribute
	 *
	 *   The API for this is a little bit funny because of the limitations of d3 and SVG:
	 *   we cannot set innerHtml directly on SVG elements, so we can't operate with simple
	 *   HTML strings; the workaround is to select the node's text element and append HTML
	 *   to it via append() and attr() functions.
	 *
	 *   Currently allowed values: "pathfinding"
	 */
	_prepNodeText: function(options) {
		options = options || {};
		var appendTemplate = function(d3el, templateName) {
			if (templateName === "pathfinding") {
				d3el.classed({pathfinding: true});
				d3el.append("tspan").attr("id", "old");
				d3el.append("tspan").attr({"id": "spc", "xml:space": "preserve"});
				d3el.append("tspan").attr("id", "new");
			} else {
				throw new Error("Unimplemented template " + templateName);
			}
		};
		var d3text = this.d3el().selectAll("[id^=node]").select("text");
		d3text.selectAll("tspan").remove();
		appendTemplate(d3text, options.template);
	},

	/**
	 *   Reset the distance display tspans from data.
	 *   By default, distances are displayed in the "new" tspan.
	 */
	_resetDistanceDisplay: function() {
		var d3nodes = this.d3el().selectAll("[id^=node]");
		d3nodes.select("text > tspan#old").text("");
		d3nodes.select("text > tspan#spc").text("");
		d3nodes.select("text > tspan#new").text(function(d) {
			return d.dist === Infinity ? '∞' : d.dist;
		});
	},

	initializeDistances: function(graph) {
		_(graph.nodes).each(function(x) {
			x.dist = Infinity;
		});
		var source = this.getSource();
		graph.nodes[source.id].dist = 0;
		this._prepNodeText({template: "pathfinding"});
		this._resetDistanceDisplay();
	},

	isTense: function(edge) {
		return edge.target.dist > edge.source.dist + edge.weight;
	},

	relax: function(edge) {
		edge.target.dist = edge.source.dist + edge.weight;
		return edge.target.dist;
	},

	deselectAll: function() {
		this.d3el().selectAll("[id^=link]").classed("status-visiting", false);
		this.d3el().selectAll("text.dist").classed("relaxing", false);
	},

	pathToString: function(path) {
		var sbuf = [];
		_(path).each(function(x) {
			sbuf.push(x.source.id + "->" + x.target.id + ";");
		});
		return sbuf.join(" ");
	},

	// return list of edges in path given a start node and edgeTo hash
	// edgeTo is a hash of nodes keyed by name
	constructPath: function(startNode, edgeTo) {
		var path = [], edge;
		while ((edge = edgeTo[startNode.id])) {
			path.push(edge);
			startNode = edge.source;
		}
		path.reverse();
		return path;
	},

	// {text: "foo"} option makes this function ignore the first argument and create
	// a label with prescribed text
	makeStepAnnotation: function(edge, options) {
		options = options || {};
		var label = "Current step:";
		if (options.text !== void 0) {
			return {
				label: label,
				text: options.text,
				style: options.style
			};
		}
		if (this.isTense(edge)) {
			return {
				label: label,
				text: (edge.source.dist + " + " + edge.weight + " < " + edge.target.dist).replace("Infinity", "∞"),
				style: {fill: "green"}
			};
		} else {
			return {
				label: label,
				text: (edge.source.dist + " + " + edge.weight + " >= " + edge.target.dist).replace("Infinity", "∞"),
				style: {fill: "red"}
			};
		}
	},

	makeShortestPathAnnotation: function(curDist) {
		return {
			label: "Shortest path:",
			text: String(curDist).replace("Infinity", "∞")
		};
	},

	makeStepNumberAnnotation: function(num) {
		return {
			label: "Steps:",
			text: String(num)
		};
	},

	initializeAnnotations: function(annotations) {
		annotations = [this.makeStepNumberAnnotation(0)].concat(annotations);
		this.renderAnnotations(annotations);
	},

	/**
	 *   To visualize a step in a general graph traversal algorithm, we will store a copy
	 *   of a graph with every state. The state of every edge and node is recorded, along with
	 *   the annotations.
	 */
	visualizeStep: function(step) {
		if (_.has(step, "debug")) { console.log(step.debug); }
		// update step # annotation
		var annotations = [this.makeStepNumberAnnotation(this.next_step)].concat(step.annotations);
		this.renderAnnotations(annotations);
		var d3el = this.d3el();
		// remove classes from previous steps
		var d3GraphElements = d3el.selectAll(".link,.node");
		d3GraphElements.each(function(d) {
			var d3this = d3.select(this);
			var oldClasses = _(d3this.attr("class").split(/\s+/)).filter(function(x) {
				return !x.match(/^status/);
			});
			d3this.attr("class", oldClasses.join(" "));
		});

		// d3ClassesToUpdate = d3el.selectAll("[class^=status]");
		// d3ClassesToUpdate.each(function(d) {
		// 	d3this = d3.select(this);
		// 	var classes = d3this.attr("class").split(/\s+/);
		// 	d3this.attr("class") =  _(classes).filter(function(x) { return !x.match(/^status/); });
		// });


		// d3el.selectAll("[id^=link]").classed("active", false);
		// d3el.selectAll("[id^=node]").classed("visiting", false);
		d3el.selectAll("[id^=link]").attr("marker-end", "url(#end)");
		d3el.selectAll("text.dist").classed("relaxing", false);
		// update all the distances
		// this.displayAllDistances(); // reset all the new/spc/old tspans
		var prevStep = this.next_step - 2 >= 0 ? this.actions[this.next_step - 2] : null;
		this.visualizeDistances(step, prevStep, {showOld: true});

		// assign all the classes in accordance to passed graph status fields
		d3el.selectAll(".link").attr("class", function(d) {
			var status = step.graph.links[d.id].getStatus() || "";
			if (status.length) {
				status = status.split(/\s+/);
				var status_ = [];
				_(status).each(function(x) { status_.push("status-" + x); });
				status = " " + status_.join(" ");
			}
			var sel = d3.select(this);
			if (!sel.classed(status)) {
				return d3.select(this).attr("class") + status;
			} else {
				return d3.select(this).attr("class");
			}
		}).each(function(d) {
			if (d3.select(this).classed("status-active")) {
				d3.select(this).attr("marker-end", "url(#end-active)");
			}
		});

		d3el.selectAll(".node").attr("class", function(d) {
			var status = step.graph.nodes[d.id].getStatus() || "";
			if (status.length) {
				status = status.split(/\s+/);
				var status_ = [];
				_(status).each(function(x) { status_.push("status-" + x); });
				status = " " + status_.join(" ");
			}
			return d3.select(this).attr("class") + status;
		});
	},

	/**
	 *   Record the state of the graph by storing a copy of the current graph
	 *   and annotations array in the `actions` array.  It is assumed that the
	 *   graph.copy() method creates deep copies of the relevant properties
	 *   (e.g. the ones determining status).
	 *   @param {Object} graph
	 *   @param {Array}  annotations
	 */
	recordStep: function(graph, annotations) {
		var step = {};
		step.annotations = _.extend([], annotations);
		step.graph = graph.copy();
		this.actions.push(step);
		// clear the graph status field
		graph.clearStatus();
	},

	runStep: function(i) {
		// bound the allowed steps
		if (i >= this.actions.length) {
			i = this.actions.length - 1;
		} else if (i < 0) {
			i = 0;
		}
		this.next_step = i + 1;
		this.visualizeStep(this.actions[i]);
		if (i === this.actions.length - 1) {
			this.animationModel.set("status", "finished");
			// setTimeout(this.deselectAll, this.timeout);
		}
	},

	runActions: function(i) {
		if (!this.actions.length) { return; }
		if (this.animationModel.get("status") !== "playing") { return; }
		i = i || 0;
		this.runStep(i);
		if (i < this.actions.length - 1) {
			setTimeout(function() { this.runActions(i+1); }.bind(this), this.timeout);
		}
	}



});
