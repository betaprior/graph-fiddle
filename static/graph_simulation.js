var app = app || {};

app.GraphSimulationView = app.GraphView.extend({

	initialize: function(options) {
		options = options || {};
		this._source = this.model.graph.nodes[options.sourceId || 0];
		this._target = this.model.graph.nodes[options.targetId || 1];
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
					this.initializeDistances(this.model.graph, this._source.id);
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
				this.initializeDistances(this.model.graph, this._source.id);
				this.next_step = 0;
			}
			this.animationModel.set("status", "paused");
			this.runStep(this.next_step - 1 + this.animationModel.get("req_steps"));
			this.animationModel.set("req_steps", 0);
		});
	},

	visualizeDistances: function(step, prevStep, options) {
		var d3el = this.d3el;
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
				}
				d3.select(this).select("#spc").text(spc);
				d3.select(this).select("#new").text(curText);
				// if (options.cls) { d3.select(this).select("#new").classed(cls, true); }
			});
	},

	showNodeDist: function(step, options) {
		options = options || {};
		var cls = options.cls;
		var node = step.edge.target;
		var dist = step.newDist;
		var oldDist = step.oldDist;
		var d3el = this.d3el;
		var sel = d3el.selectAll("#node" + node.id).select("text");
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

	// This prepares individual graph node text annotations. By default, the
	// center node text is an HTML text element with "node-text" class; depending on the
	// algorithm it can display various pieces of information.  For topological sort, for instance,
	// we could show the topological order of this node; for shortest-path finding algorithms
	// we'd like to show distance updates.
	//
	// The purpose of this function is to create appropriate templates for node text elements
	// (probably comprised of a set of tspan elements) based on the use case
	// passed in the `options` object as options.template attribute
	//
	// The API for this is a little bit funny because of the limitations of d3 and SVG:
	// we cannot set innerHtml directly on SVG elements, so we can't operate with simple
	// HTML strings; the workaround is to select the node's text element and append HTML
	// to it via append() and attr() functions.  The
	//
	// Currently allowed values: "pathfinding"
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
		var d3text = this.d3el.selectAll("[id^=node]").select("text");
		d3text.selectAll("tspan").remove();
		appendTemplate(d3text, options.template);
	},

	// This creates the text spans for node distance text; as such, this
	// must be run before any distance labels can be updated using showNodeDist.
	displayAllDistances: function(options) {
		options = options || {};
		var d3nodes = this.d3el.selectAll("[id^=node]");
		var selNew = d3nodes.select("text > tspan#new");
		var selOld = d3nodes.select("text > tspan#old");
		var selSpc = d3nodes.select("text > tspan#spc");

		selOld.text("");
		selSpc.text("");
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

	initializeDistances: function(graph, source) {
		_(graph.nodes).each(function(x) {
			x.dist = Infinity;
		});
		graph.nodes[source].dist = 0;
		this._prepNodeText({template: "pathfinding"});
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
	 * To visualize a step in a general graph traversal algorithm, we will store a copy
	 * of a graph with every state. The state of every edge and node is recorded, along with
	 * the annotations.
	 */
	visualizeStep: function(step) {
		if (_.has(step, "debug")) { console.log(step.debug); }
		// update step # annotation
		var annotations = [this.makeStepNumberAnnotation(this.next_step)].concat(step.annotations);
		this.renderAnnotations(annotations);
		// var nodeValues = d3.values(step.graph.nodes);
		// var linkValues = d3.values(step.graph.links);
		var d3el = this.d3el;
		// remove classes from previous steps
		d3el.selectAll("[id^=link]").classed("visiting", false);
		d3el.selectAll("[id^=link]").classed("active", false);
		d3el.selectAll("[id^=node]").classed("visiting", false);
		d3el.selectAll("[id^=link]").attr("marker-end", "url(#end)");
		d3el.selectAll("text.dist").classed("relaxing", false);
		// update all the distances
		this.displayAllDistances(); // reset all the new/spc/old tspans
		var prevStep = this.next_step - 2 >= 0 ? this.actions[this.next_step - 2] : null;
		this.visualizeDistances(step, prevStep, {showOld: true});

		// assign all the classes in accordance to passed graph status fields
		// var getClassed = function(list) { //TODO: replace w/ for loop to avoid overhead
		// 	return _.object(_(list).map(function(x) { return [x, true]; }));
		// };
		// d3el.selectAll("#link" + step.edge.id).classed("visiting", true);
		d3el.selectAll(".link").attr("class", function(d) {
			return d3.select(this).attr("class") + " " + step.graph.links[d.id].getStatus();
		}).each(function(d) {
			if (d3.select(this).classed("active")) {
				d3.select(this).attr("marker-end", "url(#end-active)");
			}
		});

		// d3el.selectAll(".link").each(function(d) {
		// 	if (d3.select(this).classed("active")) {
		// 		d3.select(this).attr("marker-end", "url(#end-active)");
		// 	}
		// });
		d3el.selectAll(".node").attr("class", function(d) {
			var status = step.graph.nodes[d.id].getStatus() || "";
			if (status.length) {
				status = " " + status;
			}
			return d3.select(this).attr("class") + status;
		});

		// var curNode = d3el.selectAll("#node" + step.edge.target.name);
		// curNode.classed("visiting", true);

		// // highlight currently active path:
		// d3el.selectAll("[id^=link]").classed("active", false);
		// _(step.curPath).each(function(edge) {
		// 	d3el.selectAll("#link" + edge.id).classed("active", true);
		// 	d3el.selectAll("#link" + edge.id).attr("marker-end", "url(#end-active)");
		// });

	},

	recordStep: function(graph, annotations) {
		var step = {graph: {}, annotations: annotations};
		step.graph.links = _.clone(graph.links);
		step.graph.nodes = _.clone(graph.nodes);
		// TODO: graph copy method
		_(step.graph.links).each(function(v, k) {
			step.graph.links[k] = _.clone(graph.links[k]);
		});
		_(step.graph.nodes).each(function(v, k) {
			step.graph.nodes[k] = _.clone(graph.nodes[k]);
		});
		// TODO: change these method names to copy status and clear status
		this.resetStatus(step.graph, graph);
		step.annotations = annotations;
		this.actions.push(step);
		// clear the graph status field
		this.resetStatus(graph);
	},

	resetStatus: function(graph, srcGraph) {
		var setBlankStatus = function(x) { x.clearStatus(); };
		var cloneNodeStatus = function(x) { x.copyStatus(srcGraph.nodes[x.id]); };
		var cloneLinkStatus = function(x) { x.copyStatus(srcGraph.links[x.id]); };
		_(graph.nodes).each(!srcGraph ? setBlankStatus : cloneNodeStatus);
		_(graph.links).each(!srcGraph ? setBlankStatus : cloneLinkStatus);
		// if (srcGraph) {
		// 	_(graph.nodes).each(function(x) {
		// 		x.copyStatus(srcGraph.nodes[x.id]);
		// 	});
		// 	_(graph.links).each(function(x) {
		// 		x.copyStatus(srcGraph.links[x.id]);
		// 	});
		// } else {
		// 	_(graph.nodes).each(function(x) {
		// 		x.clearStatus();
		// 	});
		// 	_(graph.links).each(function(x) {
		// 		x.clearStatus();
		// 	});
		// }


	},

	runStep: function(i) {
		// bound the allowed steps
		if (i >= this.actions.length) {
			i = this.actions.length - 1;
		} else if (i < 0) {
			i = 0;
		}
		this.next_step = i + 1;
		// this.vizStep(this.actions[i]);
		this.visualizeStep(this.actions[i]);
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
