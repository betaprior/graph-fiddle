import math
import heapq
from collections import namedtuple

ROOT_COORDS = [0, 1]

Entity = namedtuple('Entity', ['x', 'y'])

def distance(e1, e2):
	return math.sqrt((e1.x - e2.x)**2 + (e1.y - e2.y)**2)

def dist_target(e1, x, y):
	return math.sqrt((e1.x - x)**2 + (e1.y - y)**2)

class CellSearchException(Exception):
	pass

class Cell(object):
	MAXENTITIES = 2
	MINSIZE = 2 ** -24 # if 1 is the length of the equator, this gives 2.5 m resolution
	# coords of a cell are its UL corner
	# coord system: x increases L->R, y increases T->B
	# a cell is uniquely identified by its (level, x0, y0) tuple
	def __init__(self, xy0, xy1, parent=None, level=0):
		self.children = []
		self._neighbors_set = set()
		self.x0, self.y0 = xy0[0], xy0[1]
		self.x1, self.y1 = xy1[0], xy1[1]
		xp, yp = (self.x1 - self.x0) / 2 + self.x0, (self.y1 - self.y0) / 2 + self.y0
		self.xp, self.yp = xp, yp  # centroid of the cell
		self.parent = parent
		self.level = level
		self.is_leaf = True
		self.entities = []
		# min in principle unnecessary if the cells are square
		self.size = min(abs(self.x0 - self.x1), abs(self.y0 - self.y1))
		self.num_entities = 0
	def __str__(self):
		return "Cell: x0={x0}, y0={y0}, x1={x1}, y1={y1}, L={L}, N={N}".format(x0=self.x0, y0=self.y0, x1=self.x1, y1=self.y1, L=self.level, N=self.num_entities)
	def __repr__(self):
		return str(self)
	def dist(self, x, y):
		return math.sqrt((self.xp - x)**2 + (self.yp - y)**2)
	def min_entity_dist(self, x, y):
		"""Minimum distance to the target point of all entities below this node.
		This might not be very efficient if (a) minimum number of entities per node is large
		and (b) this function is invoked on a root node. In inner loops this should be called
		only on leaves."""
		return min(dist_target(e, x, y) for e in self.all_entities())
	@property	
	def neighbors(self):
		"""This cell's neighbors.  Here a cell's neighbors are all adjacent
		(via an adjoining side or a corner) cells at level <= L (level < L situation
		occurs when the neighboring cell's max depth is below L).  This implies that 
		when a cell C1 that is a neighbor of some other cell C2 gets split, and C2.level > C1.level, 
		C2's neighbor set will need to be updated."""
		return self._neighbors_set
	def add_neighbor(self, neighbor):
		self._neighbors_set.add(neighbor)
	@property
	def corners(self):
		return [(self.x0, self.y0), (self.x0, self.y1), (self.x1, self.y1), (self.x1, self.y0)]
	def is_neighbor(self, cell):
		if cell is self:
			return False
		for c in self.corners:
			if c in cell.corners:
				return True
		# if corners don't touch, check for a case of a small cell adjacent to a large cell
		if self.size <= cell.size:
			large, small = cell, self
		else:
			large, small = self, cell
		if (((large.x0 == small.x1 or large.x1 == small.x0) 
			and (small.yp > large.y0 and small.yp < large.y1)) or 
			((large.y0 == small.y1 or large.y1 == small.y0) 
			and (small.xp > large.x0 and small.xp < large.x1))):
			return True
		return False
	def _select_neighbors(self, candidates):
		"""Given a list of candidate neighbors, check that they are in fact neighbors
		and add them to the neighbor set."""
		for c in candidates:
			if self.is_neighbor(c):
				self.add_neighbor(c)
	def split(self):
		"""Split a cell. This involves:
		1. creating 4 child cells at level L+1, being careful to compute their neighbor set
		2. moving this cell's entities to the appropriate child cells
		3. updating the neighbor set of neighboring L+1 level cells"""
		def _create_children():
			self.children = [None] * 4
			self.children[0] = Cell((self.xp, self.y0), (self.x1, self.yp), parent=self, level=self.level+1)
			self.children[1] = Cell((self.x0, self.y0), (self.xp, self.yp), parent=self, level=self.level+1)
			self.children[2] = Cell((self.x0, self.yp), (self.xp, self.y1), parent=self, level=self.level+1)
			self.children[3] = Cell((self.xp, self.yp), (self.x1, self.y1), parent=self, level=self.level+1)
			neighbors_or_children = []
			for n in self.neighbors:
				if n.is_leaf:
					neighbors_or_children.extend([n])
				else:
					neighbors_or_children.extend(n.children)
			neighbor_candidates = self.children + neighbors_or_children
			for c in self.children:
				c._select_neighbors(neighbor_candidates)
		def _copy_entities():
			for e in self.entities:
				n = self.quadrant(e.x, e.y)
				self.children[n].entities.append(e)
				self.children[n].num_entities += 1
			self.entities = []
		def _update_neighbors():
			for n in self.neighbors:
				for c in n.children:
					if self in c.neighbors:
						c.neighbors.remove(self)
						c._select_neighbors(self.children)
					
		self.is_leaf = False
		_create_children()
		_copy_entities()
		_update_neighbors()
	def _all_cells(self, accum=None):
		accum = accum or []
		accum.append(self)
		for c in self.children:
			c._all_cells(accum)
		return accum
	def all_cells(self):
		"""Recursively collect all the cells in the hierarchy, 
		this cell included. Useful for debugging"""
		return self._all_cells()
	@property
	def depth(self):
		if self.is_leaf:
			return 0
		else:
			return 1 + max(c.depth for c in self.children)
	def all_entities(self):
		"""Recursively collects all the entities in the hierarchy below
		this cell.  Useful for debugging."""
		if self.is_leaf:
			return self.entities
		entities = []
		for c in self.children:
			entities.extend(c.all_entities())
		return entities
	def quadrant(self, x, y):
		"""Pick a quadrant for the (x, y) point"""
		if x > self.xp and y <= self.yp:
			return 0
		elif x <= self.xp and y <= self.yp:
			return 1
		elif x <= self.xp and y > self.yp:
			return 2
		else:
			return 3
	def add(self, entity):
		if self.is_leaf:
			self.entities.append(entity)
			cell = self
			while cell is not None:
				cell.num_entities += 1
				cell = cell.parent
			if len(self.entities) > Cell.MAXENTITIES and self.size > Cell.MINSIZE:
				self.split()
		else:
			n = self.quadrant(entity.x, entity.y)
			self.children[n].add(entity)
	def get_search_space(self, x, y, R):
		"""Find the cell forming the center of the search space.
		This cell is the smallest cell containing target coordinate with
		side length > R"""
		if self.is_leaf or self.children[0].size <= R:
			return self
		else:
			n = self.quadrant(x, y)
			return self.children[n].get_search_space(x, y, R)
	def cell_list(self, x, y, R):
		"""Returns a list of cells which contain at least one entity falling
		in the 2R x 2R square centered on (x, y)."""
		search_cell = self.get_search_space(x, y, R)
		return search_cell._get_cell_list(x, y)
	def find(self, x, y, R, heap=False, limit=None, metadata=False):
		"""Returns  entities falling in a circle of radius R centered
		on (x, y).  Optional arguments:
		- heap: return results as a Python heap (see heapq module)
		- limit: raise an exception if the search space contains too many entities
		         (note that this count overestimates the number of matches by 
		          _at least_ 2.5 to 12 times)
		"""
		search_cell = self.get_search_space(x, y, R)
		sspace_total_num = search_cell._search_space_num_entities()
		if limit is not None and sspace_total_num > limit:
			raise CellSearchException
		nodes = search_cell._get_cell_list(x, y)
		entities = []
		for n in nodes:
			for e in n.entities:
				d = dist_target(e, x, y)
				if d <= R:
					if heap:
						heapq.heappush(entities, (d, e))
					else:
						entities.append( (d, e) )
		if not heap:
			entities.sort()
		if metadata:
			return {"num_entities_estimate": sspace_total_num,
					"num_cells": len(nodes),
					"num_entities": len(entities),
					"is_heap": heap,
					"entities": entities}
		else:
			return entities
	def _build_leaves_queue(self, queue, x, y):
		# possible future optimization: limit the # of 
		# nodes in the queue
		# Note: in the future we can choose to make this into a 
		# priority queue based on either 
		# (a) self.min_entity_dist(x, y) (i.e. distance from target to closest entity in cell), or
		# (b) self.dist(x, y) (i.e. distance from target to the cell's midpoint)
		if self.is_leaf:
			if len(self.entities) > 0:
				queue.append(self)
		else:
			for c in self.children:
				c._build_leaves_queue(queue, x, y)
	def _search_space_num_entities(self):
		num_entities = self.num_entities
		for n in self.neighbors:
			num_entities += n.num_entities
		return num_entities
	def _get_cell_list(self, x, y):
		leaves = []
		self._build_leaves_queue(leaves, x, y)
		for n in self.neighbors:
			n._build_leaves_queue(leaves, x, y)
		return leaves

