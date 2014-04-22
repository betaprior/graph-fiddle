from flask import Flask
from flask import request
from flask import jsonify
from flask import render_template
from flask import make_response
app = Flask(__name__)


@app.route("/")
def root():
	return render_template('index.html')

import os
@app.route('/files/<path:path>')
def static_proxy(path):
    # send_static_file will guess the correct MIME type
    return app.send_static_file(os.path.join('files', path))

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
