import unittest
import math
from treemap2d import Cell
from treemap2d import Entity as E

X0, X1 = 0, 256

class TestQuadtreeCell(unittest.TestCase):
	def test_split(self):
		cell = Cell((X0, X0), (X1, X1))
		cell.split()
		child0 = cell.children[0]
		child1 = cell.children[1]
		child2 = cell.children[2]
		assert len(child1.neighbors) == 3
		child1.split()
		child13 = child1.children[3]
		assert len(child13.neighbors) == 6
		assert child13.is_neighbor(cell.children[0])
		assert child13.is_neighbor(cell.children[3])
		assert child13.is_neighbor(cell.children[2])
		assert child13.is_neighbor(child1.children[0])
		assert child13.is_neighbor(child1.children[1])
		assert child13.is_neighbor(child1.children[2])
		child13.split()
		child132 = child13.children[2]
		child133 = child13.children[3]
		assert len(child132.neighbors) == 5
		assert child132.is_neighbor(child13.children[0])
		assert child132.is_neighbor(child13.children[1])
		assert child132.is_neighbor(child13.children[3])
		assert child132.is_neighbor(child1.children[2])
		assert child132.is_neighbor(cell.children[2])
		cell.children[0].split()
		child02 = cell.children[0].children[2]
		assert len(child02.neighbors) == 7
		assert child02.is_neighbor(child1.children[0])
		assert child02.is_neighbor(child1.children[3])
		assert child02.is_neighbor(cell.children[2])
		assert child02.is_neighbor(cell.children[3])
		cell.children[3].split()
		cell.children[3].children[1].split()
		child311 = cell.children[3].children[1].children[1]
		assert len(child311.neighbors) == 6
		assert child311.is_neighbor(child133)
		assert child311.is_neighbor(child0.children[2])
		assert child311.is_neighbor(child2)
	def test_all_cells(self):
		root = Cell((X0, X0), (X1, X1))
		root.split() # 5 cells
		root.children[1].split() # 9 cells
		root.children[1].children[0].split() # 13 cells
		allcells = root.all_cells()
		assert len(allcells) == 13
	def test_add(self):
		Cell.MAXENTITIES = 2
		root = Cell((X0, X0), (X1, X1))
		root.add(E(10, 10))
		root.add(E(10, 10))
		assert root.depth == 0
		assert root.num_entities == 2
		root.add(E(65, 65)) # expect split
		assert root.depth == 1
		assert root.num_entities == 3
		assert root.children[1].num_entities == 3
		root.add(E(66, 66)) # expect split
		assert root.depth == 2 and root.num_entities == 4
		assert root.children[1].children[1].num_entities == 2
		assert root.children[1].children[3].num_entities == 2
		root.add(E(67, 67)) # expect split
		assert root.depth == 3 and root.num_entities == 5
	def test_min_entity_dist(self):
		Cell.MAXENTITIES = 2
		root = Cell((X0, X0), (X1, X1))
		root.add(E(10, 10))
		root.add(E(10, 10))
		root.add(E(65, 65)) # expect split
		assert root.min_entity_dist(10, 10) == 0
		assert root.min_entity_dist(10, 11) == 1
	def test_find(self):
		Cell.MAXENTITIES = 2
		root = Cell((X0, X0), (X1, X1))
		root.add(E(10, 10))
		root.add(E(10, 10))
		root.add(E(65, 65)) # expect split
		root.add(E(66, 66)) # expect split
		root.add(E(67, 67)) # expect split
		root.add(E(127, 127))
		root.add(E(129, 129))
		root.add(E(67, 127))
		root.add(E(68, 129))
		assert len(root.find(10, 10, 0.1)) == 2
		x, y = root.find(10, 10, 0.1)[0][1]
		assert x == 10 and y == 10
		assert len(root.find(63, 63, 2 * math.sqrt(2))) == 1
		assert len(root.find(63, 63, 3 * math.sqrt(2))) == 2
		
if __name__ == "__main__":
	loader = unittest.TestLoader()
	# suite = unittest.TestSuite()
	# suite.addTest(TestQuadtreeCell('test_split'))
	suites = []
	suites.append(loader.loadTestsFromTestCase(TestQuadtreeCell))
	unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(suites))
