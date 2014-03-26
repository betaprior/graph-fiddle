from treemap2d import Cell
from treemap2d import Entity
import csv
from datetime import datetime
import json

X0, X1 = 0, 256
TESTDATA = "./testdata.csv"



class Geostore(object):
	def __init__(self):
		self.root = Cell((X0, X0), (X1, X1))
		# self.load_test_data()
		self.cache = ResultsCache()
	def load_test_data(self):
		with open(TESTDATA, "rb") as csvfile:
			reader = csv.reader(csvfile)
			for row in reader:
				self.root.add(Entity(*[float(x.strip()) for x in row]))
	def add(self, x, y):
		self.root.add(Entity(x, y))
	def reset(self, ul=None, lr=None):
		ul = ul or (X0, X0)
		lr = lr or (X1, X1)
		self.root = Cell(ul, lr)
	def all_cells(self):
		cells = self.root.all_cells()
		res = []
		for c in cells:
			print c
			cellrec = {}
			for attr in ["x0", "x1", "y0", "y1", "xp", "yp", "level", "num_entities", "size"]:
				cellrec[attr] = c.__getattribute__(attr)
			res.append(cellrec)
		return json.dumps(res)
	def get_results(self, x, y, R, count=-1, offset=0):
		output = {"request_x": x, "request_y": y, "request_R": R, "count": count, "offset": offset}
		if (x, y, R) in self.cache:
			res = self.cache[(x, y, R)]
			output["cache_hit"] = True
		else:
			output["cache_hit"] = False
			res = self.root.find(x, y, R, metadata=True)
			self.cache[(x, y, R)] = res
		for key in ["num_entities_estimate", "num_cells", "num_entities", "entities"]:
			output[key] = res[key]
		if count == -1:
			output["entities"] = res["entities"]
		else:
			output["entities"] = res["entities"][offset:(offset+count)]
		return json.dumps(output)
	def _entity_gen(self, entities):
		for e in entities:
			yield e
	def get_entity_iter(self):
		return self._entity_gen(self.root.all_entities())
	def get_entity_iter1(self):
		entities = self.root.all_entities()
		def gen():
			for e in entities: yield e
		return gen

class ResultsCache(object):
    """Simple LRU cache for storing results sets
    
    Instantiated with kwargs:
      max_size - max number of items before expulsion
      expunge_size - number of least-recently accessed items
        to purge when exceeding max_size.

    Class wraps a dictionary implementing a minimal interface."""
    def __init__(self, max_size=20, expunge_size=10):
        self.d = {}
        self.CACHE_MAX_SIZE = max_size
        self.CACHE_EXPUNGE_SIZE = expunge_size
        if expunge_size >= max_size or max_size <= 2:
            raise ValueError("Bad cache size parameters")
    def __setitem__(self, key, value):
        self.d[key] = [value, datetime.now()]
        if len(self.d) > self.CACHE_MAX_SIZE:
            for ts, key in sorted([(v[1], k) for k,v in self.d.items()])[:self.CACHE_EXPUNGE_SIZE]:
                del self.d[key]
    def __getitem__(self, key):
        self.d[key][1] = datetime.now()
        return self.d[key][0]
    def __contains__(self, key):
        return key in self.d
    def __len__(self):
        return len(self.d)
    def __delitem__(self, key):
        del self.d[key]
	
