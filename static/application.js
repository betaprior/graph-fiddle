var points = [];
var width = 300, height = 300;
var svg;
var origin;
var dragging = false;
var selectionShown = false;


function distance(p, q) {
	return Math.sqrt((p[0] - q[0]) * (p[0] - q[0]) + (p[1] - q[1]) * (p[1] - q[1]));
}

function renderMatchedEntities(data) {
	console.log(data.entities);
	svg.selectAll("circle.selected").data(data.entities).enter()
		.append("svg:circle")
		.attr("class", "selected")
		.attr("stroke", "#3333FF")
		.attr("r", 5)
		.attr("cx", function(d) { console.log(d[1][0]); return d[1][0]; })
		.attr("cy", function(d) { console.log(d[1][1]); return d[1][1]; });
}		


function getSearchData(x, y, r) {
	$.getJSON($SCRIPT_ROOT + '/search', {x: x, y: y, R: r})
		.done(renderMatchedEntities);
}

function renderCells(data) {
	svg.selectAll("rect.cell").remove();
	svg.selectAll("rect.cell").data(data).enter()
		.append("svg:rect")
		.attr("class", "cell")
		.attr("x", function(d) { return d.x0; })
		.attr("y", function(d) { return d.y0; })
		.attr("width", function(d) { return d.size; })
		.attr("height", function(d) { return d.size; });
}
	

function getAllCells() {
	$.getJSON($SCRIPT_ROOT + '/all_cells')
		.done(renderCells);
}


function clickHandler() {
	if (d3.event.defaultPrevented) {
		console.log("click suppressed");
		return; // click suppressed			
	}
	if (dragging) {
		console.log("click prevented by my flag");
		dragging = false;
		return;
	}
	svg.selectAll("circle.selected").remove();
	if (selectionShown) {
		selectionShown = false;
		return;
	}
	var p = d3.mouse(this);
	points.push(p);
	$.post($SCRIPT_ROOT + '/add', {x: p[0], y: p[1]});
	refreshSVG(svg);
	getAllCells();
	
	console.log(d3.mouse(this));
}

var drag = d3.behavior.drag()
	.on("dragstart", function() {
		svg.selectAll("circle.selected").remove();
		d3.event.sourceEvent.stopPropagation(); // silence other listeners		
		var p = d3.mouse(this);
		origin = p;
		svg.selectAll('.selection').remove();
		svg.append("circle")
			.attr({"class": "selection",
				   "cx": p[0],
				   "cy": p[1]});
		console.log("dragStart");
	})
	.on("drag", function () {
		var sel = svg.selectAll('.selection');
		var p = d3.mouse(this);
		var d = distance(p, origin);
		dragging = true;
		sel.attr("r", d);
		// console.log("drag " + origin + " to " + p + ": dist " + d); 
	})
	.on("dragend", function () { 
		setTimeout(function() { dragging = false; }, 100);
		var p = d3.mouse(this);
		var d = distance(p, origin);
		if (d > 2) {
			getSearchData(origin[0], origin[1], d);
			selectionShown = true;
		}
		console.log("dragEnd; d=" + d); });

function placeSVG() {
	svg = d3.select("#svg-container").append("svg");
	// .append("rect")
	svg.attr("class", "rect-main")
		.attr("width", width)
		.attr("height", height)
		.call(drag)
		.on("click", clickHandler)
	;
}


function refreshSVG() {
	console.log(points);
	svg.selectAll("circle.point").data(points).enter()
		.append("svg:circle")
		.attr("class", "point")
		.attr("r", 4)
		.attr("cx", function(d) { return d[0]; })
		.attr("cy", function(d) { return d[1]; });
}

$(document).ready(function() {
	
	placeSVG();	
	$.post($SCRIPT_ROOT + '/reset', {x0: 0, x1: width, y0: 0, y1: height});

});
