var app = app || {}; // The Application

function hereDoc(f) {
  return f.toString().
      replace(/^[^\/]+\/\*!?/, '').
      replace(/\*\/[^\/]+$/, '');
}

// editor view goes here; this is buggy and horrible and very much a work in progress
app.EditorView = Backbone.View.extend({

	initialize: function() {
		this.template = _.template($("#editor-template").html());
		function saveCallback() {
			if (!this.cm.isClean()) {
				this.model.set("edited_code", this.cm.getValue());
				this.model.set("code_ptr", "edited_code");
				this.model.trigger("code:saved");
				console.log("setting edited value in the model");
			}
		}
		this.on("shown", function(modal) {
			console.log("in shown callback");
			var height = $(window).height() - 200;
			modal.$el.find(".modal-body").css("max-height", height);
		});
		this.on("ok", saveCallback);
	},

    render: function() {
        this.$el.html(this.template);
		var $editControls = this.$("#edit-controls");
		if (!this.model.get("user_defined") && this.model.get("edited_code").match(/\w/)) {
			$editControls.css("display", "");
		} else { // make sure code pointer is set appropriately, even though tabs are hidden
			this.model.set("code_ptr", this.model.get("user_defined") ? "edited_code" : "default_code");
		}
		var cp = this.model.get("code_ptr");
		this.$("li").removeClass("active");
		this.$("li#" + this.model.get("code_ptr")).addClass("active");
		this.$('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
			// TODO: FIXME: save code in tmp variable on tab switch
			// so that switching tabs doesn't blow away code
			console.log(e.target); // activated tab
			cp = this.$(e.target).parent().attr("id");
			// TODO: FIXME: rather than setting the code pointer here, save the
			// code pointer state to a variable and commit on save
			// (otherwise the code pointer is set incorrectly on cancel)
			this.model.set("code_ptr", cp);
			this.cm.setOption("readOnly", (cp === "default_code"));
			this.cm.setValue(this.model.get(cp));
			setTimeout(function() { this.cm.refresh(); }.bind(this), 0);

			console.log(e.relatedTarget); // previous tab
		}.bind(this));
		var that = this;
		this.$(".close-tab").click(function () {
			//there are multiple elements which have .close-tab icon so close the tab whose close icon is clicked
			var tabContentId = that.$(this).parent().attr("href");
			var $li = that.$(this).parent().parent();
			var cp = $li.attr("id");
			$li.remove();
			that.model.set(cp, "");
			console.log("Deleting buffer " + cp);
			that.$('#editor-tabs a:last').tab('show'); // Select first tab
			// that.$(tabContentId).remove(); //remove respective tab content

		});
		var cm = this.cm = CodeMirror(this.el, {
			lineNumbers: true,
			theme: "base16-light",
			mode:  "javascript"
		});
		cm.setValue(this.model.get(cp));
		cm.markClean();
		setTimeout(function() {
			cm.refresh();
		}, 0);
        return this;
    }
});


app.AlgoModel = Backbone.Model.extend({

	initialize: function(attributes, options) {
		options = options || {};
		this.animationControlsModel = options.animationControlsModel;
		this.graphModel = options.graphModel;
		// TODO: less hacky way of handling user-defined vs preset model
		if (!_.has(attributes, "algo_id") || !attributes.algo_id) {
			this.set("algo_id", "user-defined");
		}
		if (this.get("algo_id") === "user-defined") {
			this.set("user_defined", true);
		}
		if (!this.get("user_defined")) {
			this.loadDefaultCode(); // callbacks?
		}
	},

	/**
	 *   Wrap the user-visible code with setup/teardown sections
	 */
	loadCode: function() {

	},

	/**
	 *   Wraps the runAlgorithm function with an initialization step which creates
	 *   top-level graph traversal and viz API aliases visible in runAlgorithm()
	 */
	wrapCode: function(code, context) {
		var preamble = function() {
			var getSource, getTarget, setSource, setTarget, initializeDistances,
				addNodeClass, addLinkClass,
				makeStepAnnotation, makeShortestPathAnnotation, initializeAnnotations,
				isTense, relax,
				addToPath, tracePath, recordStep,
				graph;
			graph = context.model.graph;
			getSource = context.getSource.bind(context);
			getTarget = context.getTarget.bind(context);
			setSource = context.setSource.bind(context);
			setTarget = context.setTarget.bind(context);
			initializeDistances = context.initializeDistances.bind(context);
			addNodeClass = context.addNodeClass.bind(context);
			addLinkClass = context.addLinkClass.bind(context);
			makeStepAnnotation = context.makeStepAnnotation.bind(context);
			makeShortestPathAnnotation = context.makeShortestPathAnnotation.bind(context);
			initializeAnnotations = context.initializeAnnotations.bind(context);
			isTense = context.isTense.bind(context);
			addToPath = context.addToPath.bind(context);
			relax = context.relax.bind(context);
			tracePath = context.tracePath.bind(context);
			recordStep = context.recordStep.bind(context);
		};
		var fText = this.extractFunctionBody(preamble) + "\n" + this.extractFunctionBody(code);
		var f;
		eval("f = function() {" + fText + "}");
		return f;
	},

	// this is not generic! it expects an opening brace to be the last symbol on the same
	// line as the "function" keyword.  TODO: make this work properly
	extractFunctionBody: function(code) {
		var text;
		if (typeof code === "function") {
			text = code.toString();
		} else if (typeof code === "string") {
			text = code;
		} else {
			throw new Error("Code must be a function or a string");
		}
		return text.replace(/^\s*function.*{\s*\n/, "").replace(/}\s*$/,"");
	},

	loadDefaultCode: function() {
		var algoId = this.get("algo_id");
		if (!algoId) {
			throw new Error("Algo model does not have a valid ID");
		}
		this.set("default_code", app.algorithms[algoId].code.toString());
		this.set("code_ptr", "default_code");
	},

	events: {
		"change:algo_id": function() {
			if (this.get("user_defined")) {
				this.set("code_ptr", "edited_code");
			} else {
				this.loadDefaultCode();
			}
		}.bind(this)
	},

	defaults: {
		"algo_id": "",
		"title": "untitled",
		"user_defined": false,
		"code_ptr": "default_code",
		"default_code": "",
		// TODO: make the default edited_code text less kludgy
		"edited_code": "",

		// This is a "hereDoc" hack to parse a multi-line string from a comment into a variable
		// http://stackoverflow.com/questions/805107/creating-multiline-strings-in-javascript
		// TODO: remove this after debugging, it's here for debugging purposes only
		"edited_code_": hereDoc(function() {/*!
    console.log("IN DYNAMICALLY LOADED CODE");
    this.testing = "HELLO";
 	this.graphView.recordAnimatedAlgorithm = function(graph) {
		var source = this.getSource();
		var target = this.getTarget();
 		this.initializeDistances(graph, source.id);
		target = graph.nodes[3];
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
			console.log("ALGO STEP");
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
 					if (edge.target.id === target.id) {
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
		console.log("DONE RECORDING");
 	}
												 */})
	}
});
