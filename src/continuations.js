
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
  var input1 = walk.walkBack(graph, {node: mux, port: 'input1'}, _.partial(compoundPath, _, _, _, graph.parent(mux)), {keepPorts: true})
  var input2 = walk.walkBack(graph, {node: mux, port: 'input2'}, _.partial(compoundPath, _, _, _, graph.parent(mux)), {keepPorts: true})
  var control = walk.walkBack(graph, {node: mux, port: 'input2'}, _.partial(compoundPath, _, _, _, graph.parent(mux)), {keepPorts: true})
  return {input1, input2, control}
}

export function firstRecursionOnPath (graph, mux, path) {
  return _.find(path, (n) => {
    return graph.node(n.node).recursive
  })
}

export function maxIdxAndValue (list, fn) {
  var maxValue = _.maxBy(maxDistanceForAll(list, fn), (v) => v.max)
  return {
    max: maxValue.max, value: maxValue.value, index: maxValue.index
  }
}

export function maxDistanceForAll (list, fn) {
  return _.map(list, (cur, index) => {
    return { max: fn(cur) || cur.length, value: cur, index }
  })
}

function recursionContinuations (graph, mux, paths) {
  var dist1 = maxDistanceForAll(paths.input1, (i1) => {
    return Math.max(
      _.max(paths.control, (c) => path.latestSplit(graph, i1, c)),
      _.max(paths.input2, (i2) => path.latestSplit(graph, i1, i2)))
  })
  var dist2 = maxDistanceForAll(paths.input2, (i2) => {
    return Math.max(
      _.max(paths.control, (c) => path.latestSplit(graph, i2, c)),
      _.max(paths.input1, (i1) => path.latestSplit(graph, i2, i1)))
  })
  var p1 = _.map(dist1, (d) => paths.input1[d.index].slice(-d.max))
  var p2 = _.map(dist2, (d) => paths.input2[d.index].slice(-d.max))
  var rec1 = _.uniq(_.compact(_.map(p1, (p) => firstRecursionOnPath(graph, mux, p))))
  var rec2 = _.uniq(_.compact(_.map(p2, (p) => firstRecursionOnPath(graph, mux, p))))
  return _.compact(_.flatten([
    (rec1.length > 0) ? _.map(rec1, (r) => ({node: r.node, port: 'input1'})) : null,
    (rec2.length > 0) ? _.map(rec2, (r) => ({node: r.node, port: 'input2'})) : null
  ]))
}

function muxStarts (graph, paths, port) {
  return _.compact(
    _.map(paths, (p) => {
      if (graph.node(p[0].node).id === 'logic/mux') {
        return {node: p[0].node, port}
      }
    }))
}

export function continuationsForMux (graph, mux, option) {
  var paths = muxInPortPathes(graph, mux)
  return {
    mux,
    continuations: _.concat(recursionContinuations(graph, mux, paths), muxStarts(graph, paths.input1, 'input1'), muxStarts(graph, paths.input2, 'input2'))
  }
}

export function addContinuations (graph, options = {mode: 'only necessary'}) {
  var muxes = utils.getAll(graph, 'logic/mux')
  var cnts = _.reject(_.map(muxes, _.partial(continuationsForMux, graph, _, options)), (m) => m.continuations.length === 0)
  var cntNodes = _.map(_.flatten(_.map(cnts, (c) => c.continuations)), 'node')
  var muxTable = _.keyBy(cnts, 'mux')
  var recursives = _.flatten(_.map(cntNodes, (n) => (graph.node(n).recursive) ? graph.node(n).recursesTo.branch : []))
  var cntTable = _.fromPairs(_.map(cntNodes, (c) => [c, true]))
  var recTable = _.fromPairs(_.map(recursives, (c) => [c, true]))
  var editGraph = utils.edit(graph)

  return utils.finalize(_.merge({}, editGraph, {
    nodes: _.map(editGraph.nodes, (n) => {
      var node = n
      if (_.has(cntTable, n.v)) {
        node = _.merge({}, node, {value: {params: {isContinuation: cntTable[n.v]}}})
      }
      if (_.has(recTable, n.v)) {
        node = _.merge({}, node, {value: {params: {isContinuation: recTable[n.v], recursiveRoot: true}}})
      }
      if (_.has(muxTable, n.v)) {
        node = _.merge({}, node, {value: {params: {continuations: muxTable[n.v].continuations}}})
      }
      return node
    }),
    edges: _.concat(editGraph.edges, _.flatten(_.map(cnts, (c) =>
      _.map(c.continuations, (n) => ({
        v: c.mux,
        w: n.node,
        name: c.mux + '→→' + n.node + '@' + n.port,
        value: {
          continuation: true
        }
      })))
    ))
  }))
}
