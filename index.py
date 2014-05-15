from flask import Flask
from flask import request
from flask import jsonify
from flask import render_template
from flask import make_response
import re
app = Flask(__name__)


@app.route("/")
def root():
	return render_template('index.html')

@app.route("/e/<string:algoname>")
def get_algo_text(algoname):
	algofile = "static/algorithms.js"
	patt_start = "^\s*/\*\s*BEGIN\s+ALGORITHM\s+%s" % algoname
	patt_end = "^\s*/\*\s*END\s+ALGORITHM"
	linebuffer = []
	with open(algofile, 'r') as f:
		buffering = False
		for line in f:
			if re.match(patt_start, line):
				buffering = True
				continue
			if buffering and re.match(patt_end, line):
				buffering = False
				break
			if buffering:
				linebuffer.append(line.rstrip())
	return render_template('algocode', lines=linebuffer)

@app.route("/testtemplate")
def test_template():
	lines = ["one", "two", "three"]
	return render_template('algocode', lines=lines)

@app.route("/test<string:num>")
def numbered_test(num):
	return render_template('test' + num + '.html')


import os
@app.route('/files/<path:path>')
def static_proxy(path):
    # send_static_file will guess the correct MIME type
    return app.send_static_file(os.path.join('files', path))

@app.route('/fonts/<path:path>')
def static_proxy_fonts(path):
    # send_static_file will guess the correct MIME type
    return app.send_static_file(os.path.join('fonts', path))


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

@app.errorhandler(InvalidSearch)
def handle_invalid_search(error):
	response = jsonify(error.to_dict())
	response.status_code = error.status_code
	return response



if __name__ == "__main__":
	app.run(debug=True)
