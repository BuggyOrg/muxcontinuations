
import {utils, walk, path} from '@buggyorg/graphtools'
import _ from 'lodash'

function compoundPath (graph, node, port, parent) {
  var curNode = graph.node(node)
  if (node === parent) {
    return [] // found input port of underlying compound node
  } else if (_.includes(_.keys(curNode.inputPorts), port)) {
    return [port]
  } else if (curNode.id === 'logic/mux') {
    return [] // if it is not the mux we started at, stop here!
  } else {
    return _.keys(curNode.inputPorts)
  }
}

export function muxInPortPathes (graph, mux) {
  // the input ports of a mux are 'control', 'input1' and 'input2'
  var input1 = walk.walkBack(graph, {node: mux, port: 'input1'}, _.partial(compoundPath, _, _, _, graph.parent(mux)))
  var input2 = walk.walkBack(graph, {node: mux, port: 'input2'}, _.partial(compoundPath, _, _, _, graph.parent(mux)))
  var control = walk.walkBack(graph, {node: mux, port: 'input2'}, _.partial(compoundPath, _, _, _, graph.parent(mux)))
  return {input1, input2, control}
}

export function firstRecursionOnPath (graph, mux, path) {
  return _.find(path, (n) => {
    return graph.node(n).recursive
  })
}

export function maxIdxAndValue (list, fn) {
  return _.reduce(list, (acc, cur, index) => {
    if (acc) {
      var newVal = fn(cur)
      if (newVal < acc.max) {
        return acc
      }
    }
    return {max: newVal, value: cur, index}
  }, null)
}

function recursionContinuations (graph, mux, paths) {
  var idx1 = maxIdxAndValue(paths.input1, (i1) => {
    return Math.max(
      _.max(paths.control, (c) => path.latestSplit(graph, i1, c)),
      _.max(paths.input2, (i2) => path.latestSplit(graph, i1, i2)))
  })
  var idx2 = maxIdxAndValue(paths.input2, (i2) => {
    return Math.max(
      _.max(paths.control, (c) => path.latestSplit(graph, i2, c)),
      _.max(paths.input1, (i1) => path.latestSplit(graph, i2, i1)))
  })
  var p1 = paths.input1[idx1.index].slice(idx1.value + 1)
  var p2 = paths.input2[idx2.index].slice(idx2.value + 1)
  var rec1 = firstRecursionOnPath(graph, mux, p1)
  var rec2 = firstRecursionOnPath(graph, mux, p2)
  return _.compact([rec1, rec2])
}

function muxStarts (graph, paths) {
  return _.compact(
    _.map(paths, (p) => {
      if (graph.node(p[0]).id === 'logic/mux') {
        return p[0]
      }
    }))
}

export function continuationsForMux (graph, mux, option) {
  var paths = muxInPortPathes(graph, mux)
  return {
    mux,
    continuations: _.concat(recursionContinuations(graph, mux, paths), muxStarts(graph, paths.input1), muxStarts(graph, paths.input2))
  }
}

export function addContinuations (graph, options = {mode: 'only necessary'}) {
  var muxes = utils.getAll(graph, 'logic/mux')
  var cnts = _.reject(_.map(muxes, _.partial(continuationsForMux, graph, _, options)), (m) => m.continuations.length === 0)
  var cntNodes = _.flatten(_.map(cnts, (c) => c.continuations))
  var muxTable = _.keyBy(cnts, 'mux')
  var cntTable = _.fromPairs(_.map(cntNodes, (c) => [c, true]))
  var editGraph = utils.edit(graph)

  return utils.finalize(_.merge({}, editGraph, {
    nodes: _.map(editGraph.nodes, (n) => {
      var node = n
      if (_.has(cntTable, n.v)) {
        node = _.merge({}, node, {value: {settings: {isContinuation: cntTable[n.v]}}})
      }
      if (_.has(muxTable, n.v)) {
        node = _.merge({}, node, {value: {settings: {continuations: muxTable[n.v].continuations}}})
      }
      return node
    }),
    edges: _.concat(editGraph.edges, _.flatten(_.map(cnts, (c) =>
      _.map(c.continuations, (n) => ({
        v: c.mux,
        w: n,
        name: c.mux + '→→' + n,
        value: {
          continuation: true
        }
      })))
    ))
  }))
}
