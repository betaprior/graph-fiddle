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
	getGraphOptions: function() {
		return this.pick("V", "graph_type");
	}
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
		this.generators = {
			worst_dijkstra: this.makeWorstDijkstraPresets,
			bst: this.makeBSTPresets,
			toposort: this.makeTopoSortPresets,
			blank:this.makeBlankPresets
		};
		_.each(this.generators, function(gen, id) {
			var model = new app.UISettingsModel({current_demo: id});
			gen(model);
			this.add(model);
		}.bind(this));
	},

	populateSettingsModel: function(model, id) {
		if (id === void 0) {
			id = model.get("current_demo");
		}
		this.generators[id](model);
	},

	getDefault: function() {
		var model = this.find(function(x) {
			return x.get("title") === "Worst Dijkstra";
		});
		return model;
	},
	makeWorstDijkstraPresets: function(model) {
		model.set({
			title: "Worst Dijkstra",
			V: 6,
			graph_type: "worst_dijkstra",
			explanation_visibility: "full",
			explanation_text: "When we run Dijkstra's algorithm on a graph with negative-weighted edges, the greedy heuristic by which the algorithm picks the next edge to explore is no longer guaranteed to be optimal. Indeed, we can construct a graph that makes the algorithm perform an exponential number of steps!",
			graph_options: { showLabels: false, showWeights: true, showInitialDistances: true },
			algos: ["dijkstra",
					"bellman-ford",
					"toposort"]
		});
	},
	makeBSTPresets: function(model) {
		model.set({
			title: "Binary Trees",
			V: 10,
			graph_type: "bst",
			// explanation_visibility: "collapsed",
			explanation_visibility: "hidden",
			graph_options: { showLabels: true, showWeights: false },
			algos: ["dfs"]
		});
	},
	makeTopoSortPresets: function(model) {
		model.set({
			title: "Topological Sort",
			V: 6,
			graph_type: "worst_dijkstra",
			graph_options: { showLabels: true, showWeights: false },
			explanation_visibility: "hidden",
			algos: []
		});
	},
	makeBlankPresets: function(model) {
		model.set({
			title: "Blank",
			V: 5,
			graph_type: "",
			explanation_visibility: "hidden",
			algos: []
		});
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
		this.min = 2; // TODO: make sure existing algos work with a single-vtx graph
		this.max = options.max || 100;
		this.defaultVal = options.val || 4;
	},

	render: function() {
		this.$el.html(this.template);
		this.$spinner = this.$(".spinner input");
		this._initSpinner();
		return this;
	},

	set: function(val) {
		this.$spinner.val(val);
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
 *
 *   Displays a selectable list of demos.
 *
 *   Arguments (in options hash):
 *   - collection: collection of `UISettingsModel`s for the presets
 *   - model: current UISettingsModel
 */
app.DemosListView = Backbone.View.extend({
	initialize: function() {
		this.template = _.template($("#demos-list-template").html());
		this.label = "Presets";
		this.listenTo(this.model, "change:current_demo", this._updateDemoButton);
	},

	_updateDemoButton: function() {
		var $presetsList = this.$("ul.presets-list");
		this.$("li", $presetsList).removeClass("active");
		this.$("li#" + this.model.get("current_demo"), $presetsList).addClass("active");
	},

	_makeItemElement: function(model) {
		return $("<li id='" + model.get("current_demo") + "'><a href='#'>" +
				 model.get("title") + "</a></li>");
	},

	render: function() {
		this.$el.html(this.template);
		this.$(".labeled-panel").attr("data-content", this.label);
		var $presetsList = this.$("ul.presets-list");
		var setDemo = function(x) { this.model.set("current_demo", x); }.bind(this);
		this.collection.each(function(presetModel) {
			var $presetItem = this._makeItemElement(presetModel);
			$presetItem.click(function(e) {
				setDemo($(this).attr("id"));
			});
			$presetsList.append($presetItem);
		}.bind(this));
		this._updateDemoButton();
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
		this.listenTo(this.model, "change:explanation_visibility change:current_demo", this.render);
	},

	render: function() {
		this.$el.html(this.template);
		if (this.model.get("explanation_visibility") === "hidden") {
			this.$el.hide();
		} else {
			this.$el.show();
		}
		if (this.model.has("explanation_text")) {
			this.$(".panel-body").html(this.model.get("explanation_text"));
		} else {
			this.$(".panel-body").text("I am a " + this.model.get("explanation_visibility") + " explanation!");
		}
		return this;
	}
});

/**
 *   GraphOptionsView
 *
 *   Displays global options for a graph.
 *
 *   Arguments (in the options hash):
 *   - model: UISettings model whose attributes include [graph_type, V]
 *
 *   Options:
 *   - presets: a set of {id: "title"} KV pairs to populate the graph choice menu
 */
app.GraphOptionsView = Backbone.View.extend({
	initialize: function(options) {
		this.options = options || (options = {});
		if (!options.presets) {
			var gm = new app.GraphModel;
			this.options.presets = gm.getGraphTypes({titleOnly: true});
		}
		this.template = _.template($("#graph-options-template").html());
		this.spinnerView = new app.SpinnerBoxView();
		this._bindEvents();
	},

	_bindEvents: function() {
		this.listenTo(this.spinnerView, "update", function(x) {
			this.model.set("V", x);
		});
		this.listenTo(this.model, "change:V change:graph_type", function() {
			this._updateButtonLabel();
			this.spinnerView.set(this.model.get("V"));
		});
	},

	render: function() {
		this.$el.html(this.template);
		var $spinner = this.$("#vertex-spinner-control");
		this.spinnerView.setElement($spinner).render();
		this._populateGraphChoices();
		this._updateButtonLabel();
		this.spinnerView.set(this.model.get("V"));
		return this;
	},

	_updateButtonLabel: function() {
		var text = this.options.presets[this.model.get("graph_type")];
		if (!text) {
			text = "";
		}
		this.$("button.dropdown-toggle .my-label").text(text);
	},

	_populateGraphChoices: function() {
		var $graphList = this.$(".graph-choices");
		var setType = function(x) { this.model.set("graph_type", x); }.bind(this);
		var updateLabel = _.bind(this._updateButtonLabel, this);
		_.each(this.options.presets, function(v, k) {
			var $item = $("<li id='" + k + "'><a href='#'>" + v + "</a></li>");
			$item.click(function(e) {
				setType($(this).attr("id"));
				updateLabel();
			});
			$graphList.append($item);
		});
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
		this._setupAlgoViews();
		this.addAlgoView = new app.AddAlgoView();
		this.listenTo(this.model, "change:V change:graph_type change:algos", function() {
			this._setupAlgoViews();
			this.render();
		});
	},

	_setupAlgoViews: function() {
		var algos = this.model.get("algos");
		var V = this.model.get("V");
		_.each(this.algoViews, function(v) {
			v.remove();
		});
		this.algoViews = {};
		_.each(algos, function(algoId) {
			var graphModel = new app.GraphModel({V: V});
			graphModel.makePresetGraph(this.model.getGraphOptions());
			this.algoViews[algoId] = new app.AlgoView({
				algorithm: algoId,
				graph_type: this.model.get("graph_type"),
				model: new app.AlgoModel({algo_id: algoId, title: app.algorithms[algoId].title}),
				graphModel: graphModel,
				graphOptions: this.model.get("graph_options")
			});
		}, this);

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
 *
 *   Arguments:
 *   - graph_type: graph type that's passed on to the graph renderer
 *   - algorithm: algorithm ID
 */
app.AlgoView = Backbone.View.extend({
	initialize: function(options) {
		this.options = options = options || {};
		this.template = _.template($("#algoview-template").html());
		this.stateModel = new app.AnimationStateModel();
		this.controlsView = new app.AnimationControlsView({model: this.stateModel});
		this.graphModel = options.graphModel || new app.GraphModel({V: 6});
		this.graphView = new app.GraphAlgorithmView(_.extend({
			animationModel: this.stateModel,
			model: this.graphModel,
			graph_type: options.graph_type,
			algorithm: options.algorithm
		}, options.graphOptions));
		this._setupEditor();
	},

	events: {
		"click .algo-container .edit-link a": "launchEditor"
	},


	_setupEditor: function() {
		this.listenTo(this.model, "code:saved", function(model, value, options) {
			var cp = this.model.get("code_ptr");
			console.log("Loading algorithm from editor buffer " + cp);
			var code = this.model.get(cp);
			if (code) {
				eval(code);
				console.log("Re-rendering the view");
				this.graphView.render();
			}
		}.bind(this));
	},

	launchEditor: function() {
		var _listenTo = this.listenTo;
		console.log("Edit clicked");
		var view = new app.EditorView({model: this.model});
		var modal = new Backbone.BootstrapModal({
			content: view,
			title: "Edit this algorithm!",
			animate: false
		});
		_listenTo(modal, "hidden", function() { console.log("hidden callback"); });
		modal.open();
		modal.$el.addClass("modal-wide");
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
 *   - algorithm: algorith ID
 *   - graph_type: graph type that's passed on to the graph renderer
 */
app.GraphAlgorithmView = app.AnimatedSimulationBase.extend({
	initialize: function(options) {
		// retrieve the algorithm code from the global app.algorithms object and assign it
		// as an instance method
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
		this.demosListView = new app.DemosListView({
			collection: this.presetsCollection,
			model: this.settingsModel
		});
		this.listenTo(this.settingsModel, "change:current_demo", this._updateSettingsModel);
		this.graphOptionsView = new app.GraphOptionsView({model: this.settingsModel});
		this.explanationView = new app.ExplanationView({model: this.settingsModel});
		this.graphVizView = new app.GraphVizView({model: this.settingsModel});
	},

	_updateSettingsModel: function() {
		this.presetsCollection.populateSettingsModel(this.settingsModel);
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
