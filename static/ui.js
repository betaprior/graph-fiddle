var app = app || {}; // The Application

/**
 *   ui.js
 *
 *   This file is responsible for loading and organizing the main UI layout.
 */

/**
 *   UISettingsModel
 *
 *   Model containing settings for the various UI components.  Note that all UI components
 *   share the same settings model, so the settings attributes must be named appropriately
 *   (e.g. 'graph_selection' or 'algo_selection' vs 'selection').
 */
app.UISettingsModel = Backbone.Model.extend({
});

/**
 *   DemosPresetsCollection
 *
 *   Responsible for managing saved demos. Stores models that are used to populate
 *   UI panels when the demo is selected.
 *   The collection holds UISettings models
 */
app.DemosPresetsCollection = Backbone.Collection.extend({
	initialize: function() {
		this.makeWorstDijkstraPresets();
		this.makeBSTPresets();
		this.makeTopoSortPresets();
	},
	getDefault: function() {
		var model = this.find(function(x) {
			return x.get("title") === "Worst Dijkstra";
		});
		return model;
	},
	makeWorstDijkstraPresets: function() {
		var model = new app.UISettingsModel();
		model.set({
			title: "Worst Dijkstra",
			V: 6,
			graph_type: "worst_dijkstra",
			explanation_visibility: "full",
			algos: ["dijkstra",
					"bellman-ford",
					"toposort"]
		});
		this.add(model);
	},
	makeBSTPresets: function() {
		var model = new app.UISettingsModel();
		model.set({
			title: "Binary Trees",
			V: 16,
			graph_type: "bst",
			explanation_visibility: "collapsed",
			algos: ["dfs"]
		});
		this.add(model);
	},
	makeTopoSortPresets: function() {
		var model = new app.UISettingsModel();
		model.set({
			title: "Topological Sort",
			V: 6,
			graph_type: "worst_dijkstra",
			graph_options: { showLabels: true, showWeighs: false },
			explanation_visibility: "hidden",
			algos: []
		});
		this.add(model);
	}
});

/**
 *   SpinnerBoxView
 *
 *   Implements a basic spinner element.
 *   Triggers an 'update' event with the current value
 */
app.SpinnerBoxView = Backbone.View.extend({
	initialize: function(options) {
		options = options || {};
		this.template = _.template($("#spinner-template").html());
		this.min = 1;
		this.max = options.max || 100;
		this.defaultVal = options.val || 4;
	},

	render: function() {
		this.$el.html(this.template);
		this.$spinner = this.$(".spinner input");
		this._initSpinner();
		return this;
	},

	_bindSpinnerArrows: function() {
		// needed to return false from handlers, when the spinner element was part of a form
		// element (bootstrap would try to submit the form and reload the page)
		var onClickUp = function() {
			if (this._getVal() < this.max) {
				this.$spinner.val(this._getVal() + 1);
				this.trigger("update", this._getVal());
			}
			return false;
		}.bind(this);
		var onClickDown = function() {
			if (this._getVal() > this.min) {
				this.$spinner.val(this._getVal() - 1);
				this.trigger("update", this._getVal());
			}
			return false;
		}.bind(this);
		this.$(".spinner .btn:first-of-type").on("click", onClickUp);
		this.$(".spinner .btn:last-of-type").on("click", onClickDown);
	},

	_bindSpinnerInput: function() {
		var onChange = function() {
			if (this.$spinner.val().match(/^\d+$/)) {
				var v = this._getVal();
				if (v >= this.min && v <= this.max) {
					this.trigger("update", v);
					return;
				}
			}
		}.bind(this);
		this.$spinner.change(onChange);
	},

	_initSpinner: function() {
		this._bindSpinnerArrows();
		this._bindSpinnerInput();
		this.$spinner.val(this.defaultVal);
	},

	_getVal: function() {
		return parseInt(this.$spinner.val(), 10);
	}
});

/**
 *   DemosListView
 */
app.DemosListView = Backbone.View.extend({
	initialize: function() {
		this.template = _.template($("#demos-list-template").html());
		this.label = "Presets";
	},

	render: function() {
		this.$el.html(this.template);
		this.$(".labeled-panel").attr("data-content", this.label);
		return this;
	}
});

/**
 *   ExplanationView
 *
 *   Optional panel containing information about the current demo.
 *   Visibility controlled by explanation_visibility property of the settings model,
 *   which must be one of ["full", "collapsed", "hidden"].
 */
app.ExplanationView = Backbone.View.extend({
	initialize: function() {
		this.template = _.template($("#explanation-template").html());
	},

	render: function() {
		this.$el.html(this.template);
		this.$(".panel-body").text("I am a " + this.model.get("explanation_visibility") + " explanation!");
		return this;
	}
});

/**
 *   GraphOptionsView
 */
app.GraphOptionsView = Backbone.View.extend({
	initialize: function() {
		this.template = _.template($("#graph-options-template").html());
		this.spinnerView = new app.SpinnerBoxView();
		this.listenTo(this.spinnerView, "update", function(x) {
			console.log("Spinner updated with value " + x);
		});
	},

	render: function() {
		this.$el.html(this.template);
		var $spinner = this.$("#vertex-spinner");
		this.spinnerView.setElement($spinner).render();
		return this;
	}
});

/**
 *   GraphVizView
 *
 *   Container view for demo graphs and their associated controls
 *
 *   Arguments:
 *   - model: UI settings model
 */
app.GraphVizView = Backbone.View.extend({
	initialize: function(options) {
		this.template = _.template($("#graphviz-template").html());
		if (!options.model.has("algos") || !options.model.has("V")) {
			throw new Error("UI model has to provide a list of algorithms and # of vertices.");
		}
		var algos = options.model.get("algos");
		var V = options.model.get("V");
		this.algoViews = {};
		_.each(algos, function(algoName) {
			console.log("algo: " + algoName);
			this.algoViews[algoName] = new app.AlgoView({
				algorithm: algoName,
				graphModel: new app.GraphModel({V: V})
			});
		}, this);
		this.addAlgoView = new app.AddAlgoView();
	},

	render: function() {
		this.$el.html(this.template);
		this._renderGraphs();
		this._renderAddPlaceholder();
		return this;
	},

	_renderGraphs: function() {
		_.each(this.algoViews, function(v) {
			this.$("#algo-view-container").append(v.render().$el);
		}, this);
	},

	_renderAddPlaceholder: function() {
		this.$("#algo-view-container").append(this.addAlgoView.render().$el);
	}
});

/**
 *   AddAlgoView
 *
 *   View that shows up as last in the algorithm views sequence, and contains a
 *   "new view" element to create a new algorithm view.
 */
app.AddAlgoView = Backbone.View.extend({
	initialize: function() {
		this.template = _.template($("#algoview-placeholder-template").html());
	},

	render: function() {
		this.$el.html(this.template);
		return this;
	}
});

/**
 *   AlgoView
 *
 *   Main view for an individual algorithm visualization; contains graph canvas
 *   and animation controls.  Keeps track of the animation state model.
 */
app.AlgoView = Backbone.View.extend({
	initialize: function(options) {
		this.options = options = options || {};
		this.template = _.template($("#algoview-template").html());
		this.stateModel = new app.AnimationStateModel();
		this.controlsView = new app.AnimationControlsView({model: this.stateModel});
		this.graphModel = options.graphModel || new app.GraphModel({V: 6});
		this.graphView = new app.GraphAlgorithmView({
			animationModel: this.stateModel,
			model: this.graphModel,
			algorithm: options.algorithm
		});
	},

	render: function() {
		this.$el.html(this.template);
		this.$(".labeled-panel").attr("data-content", app.algorithms[this.options.algorithm].title);
		this.controlsView.setElement(this.$(".animation-controls-container")).render();
		this.graphView.setElement(this.$(".graph-container")).render();
		return this;
	}
});

/**
 *   GraphAlgorithmView
 *
 *   Individual graph visualization/animation container.
 *   Displays the SVG with the graph and optional annotations.
 *
 *   Arguments:
 *   - animationModel: animation state model
 *   - model: graph model
 *   - algorithm: algorith name
 */
app.GraphAlgorithmView = app.AnimatedSimulationBase.extend({
	initialize: function(options) {
		// retrieve the algorithm code from the global app.algorithms object and assign it
		// as a class method
		this.recordAnimatedAlgorithm = app.algorithms[options.algorithm].code.bind(this);
		app.AnimatedSimulationBase.prototype.initialize.apply(this, arguments);
	}
});

/**
 *   AnimationStateModel
 *
 *   Simple model to keep track of the animation state, as well as controls input.
 */
app.AnimationStateModel = Backbone.Model.extend({
	defaults: {
		status: "new",
		req_steps: 0
	}
});

/**
 *   AnimationControlsView
 *
 *   Block of animation controls buttons. State determined by the AnimationStateModel
 *   (supplied in the `model` initializer argument).
 *
 *   Options:
 *   - showOnly: [$BUTTON1, $BUTTON2, ...] - display only the buttons with id==$BUTTON1 and $BUTTON2
 */
app.AnimationControlsView = Backbone.View.extend({
	initialize: function(options) {
		this.options = options || {};
		this.template = _.template($("#animation-controls-template").html());
		this.model.on('change:status', this.render, this);
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


/**
 *   MainView
 *
 *   Loads and renders all the UI subviews, as well as their underlying models.
 */
app.MainView = Backbone.View.extend({

	el: "#app-container",

	initialize: function() {
		this.presetsCollection = new app.DemosPresetsCollection();
		this.settingsModel = this.presetsCollection.getDefault();
		this.demosListView = new app.DemosListView({collection: this.presetsCollection});
		this.graphOptionsView = new app.GraphOptionsView({model: this.settingsModel});
		this.explanationView = new app.ExplanationView({model: this.settingsModel});
		this.graphVizView = new app.GraphVizView({model: this.settingsModel});
	},
	render: function() {
		this.$el.append(this.demosListView.render().$el)
			.append(this.graphOptionsView.render().$el)
			.append(this.explanationView.render().$el)
			.append(this.graphVizView.render().$el);
	}
});


$(document).ready(function () {
	var main = new app.MainView();
	main.render();
});
