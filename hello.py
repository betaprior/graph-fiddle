from flask import Flask
from flask import request
from flask import jsonify
from flask import render_template
from flask import make_response
from geostore import Geostore
app = Flask(__name__)

store = Geostore()

@app.route("/")
def root():
	return render_template('index.html')

@app.route("/clickdrag2")
def clickdrag2():
	return render_template('clickdrag2.html')

@app.route("/clickdrag3")
def clickdrag3():
	return render_template('clickdrag3.html')

@app.route('/add', methods=['POST'])
def add():
	if not ('x' in request.form and 'y' in request.form):
		raise InvalidPoint("No x ad y parameter specified in request")
	x = float(request.form.get('x'))
	y = float(request.form.get('y'))
	store.add(x, y)
	resp = make_response('{"add_point": "ok"}')
	resp.headers['Content-Type'] = "application/json"
	return resp

@app.route('/reset', methods=['POST'])
def reset():
	if all(x in request.form for x in ['x0', 'y0', 'x1', 'y1']):
		ul = ( float(request.form.get('x0')), float(request.form.get('y0')) )
		lr = ( float(request.form.get('x1')), float(request.form.get('y1')) )
		store.reset(ul, lr)
	else:
		store.reset()
	resp = make_response('{"reset_store": "ok"}')
	resp.headers['Content-Type'] = "application/json"
	return resp
	
@app.route("/all_cells")
def all_cells():
	return store.all_cells()

@app.route("/search")
def search():
	x, y, R = parse_args()
	count = request.args.get('count', -1, type=int)
	offset = request.args.get('offset', 0, type=int)
	return store.get_results(x, y, R, count, offset)


def parse_args():
	if "long" in request.args:
		x = request.args.get('long', 0, type=float)
	elif "x" in request.args:
		x = request.args.get('x', 0, type=float)
	else:
		raise InvalidSearch("long or x parameter missing")
	if "lat" in request.args:
		y = request.args.get('lat', 0, type=float)
	elif "y" in request.args:
		y = request.args.get('y', 0, type=float)
	else:
		raise InvalidSearch("lat or y parameter missing")
	if "R" in request.args:
		R = request.args.get('R', 0, type=float)
	elif "r" in request.args:
		R = request.args.get('r', 0, type=float)
	else:	
		raise InvalidSearch("R parameter missing")
	return (x, y, R)


class InvalidSearch(Exception):
	status_code = 400
	def __init__(self, message, status_code=None, payload=None):
		Exception.__init__(self)
		self.message = message
		if status_code is not None:
			self.status_code = status_code
		self.payload = payload
	def to_dict(self):
		rv = dict(self.payload or ())
		rv['message'] = self.message
		return rv

class InvalidPoint(Exception):
	status_code = 400
	def __init__(self, message, status_code=None, payload=None):
		Exception.__init__(self)
		self.message = message
		if status_code is not None:
			self.status_code = status_code
		self.payload = payload
	def to_dict(self):
		rv = dict(self.payload or ())
		rv['message'] = self.message
		return rv

@app.errorhandler(InvalidSearch)
def handle_invalid_search(error):
	response = jsonify(error.to_dict())
	response.status_code = error.status_code
	return response

@app.errorhandler(InvalidPoint)
def handle_invalid_point(error):
	response = jsonify(error.to_dict())
	response.status_code = error.status_code
	return response


if __name__ == "__main__":
	app.run(debug=True)
