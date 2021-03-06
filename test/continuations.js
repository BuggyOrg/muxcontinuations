/* global describe, it */

import chai from 'chai'
import * as api from '../src/continuations.js'
import grlib from 'graphlib'
import fs from 'fs'
// import _ from 'lodash'

var expect = chai.expect

describe('Find first recursion on a path', () => {
  it('can find the correct input pathes of a mux', () => {
    var factorial = grlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/factorial.json')))
    var paths = api.muxInPortPathes(factorial, 'factorial_10:mux_0')
    expect(paths).to.be.ok
    expect(paths.input1).to.have.length(1)
    expect(paths.input2).to.have.length(3)
  })

  it('stops the input path of a mux on another mux', () => {
    var ack = grlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/ack.json')))
    var paths = api.muxInPortPathes(ack, 'ack_20:mux_0')
    expect(paths).to.be.ok
    expect(paths.input1).to.have.length(2)
    expect(paths.input2).to.have.length(1)
    expect(paths.input2[0]).to.have.length(2)
  })

  it('can find the recursion on a path', () => {
    var factorial = grlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/factorial.json')))
    var paths = api.muxInPortPathes(factorial, 'factorial_10:mux_0')
    var recursion = api.firstRecursionOnPath(factorial, 'factorial_10:mux_0', paths.input2[1])
    expect(recursion).to.be.ok
    expect(recursion.node).to.eql('factorial_10:factorial_3')
  })

  it('returns undefined if there is no recursion on the path', () => {
    var factorial = grlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/factorial.json')))
    var paths = api.muxInPortPathes(factorial, 'factorial_10:mux_0')
    var recursion = api.firstRecursionOnPath(factorial, 'factorial_10:mux_0', paths.input2[0])
    expect(recursion).to.be.undefined
  })
})

describe('Processing paths to multiplexers inputs', () => {
  it('can find recursion in mux paths', () => {
    var factorial = grlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/factorial.json')))
    var cnts = api.continuationsForMux(factorial, 'factorial_10:mux_0', {mode: 'only necessary'})
    expect(cnts.continuations).to.be.ok
    expect(cnts.continuations).to.have.length(2)
    expect(cnts.continuations[0]).to.eql({node: 'factorial_10:factorial_3', port: 'input2', type: 'recursion'})
  })

  it('can finds muxes on mux paths', () => {
    var factorial = grlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/ack.json')))
    var cnts = api.continuationsForMux(factorial, 'ack_20:mux_0', {mode: 'only necessary'})
    expect(cnts.continuations).to.be.ok
    expect(cnts.continuations).to.have.length(1)
    expect(cnts.continuations[0]).to.eql({node: 'ack_20:mux_3', port: 'input2'})
  })

  describe('Mode: Only necessary', () => {
    it('does not replace simple cases', () => {
      var graph = grlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/mux.json', 'utf8')))
      var newGraph = api.addContinuations(graph, {mode: 'only necessary'})
      expect(grlib.json.write(newGraph)).to.deep.equal(grlib.json.write(graph))
    })

    it('creates two continuation for the factorial example', () => {
      var graph = grlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/factorial.json', 'utf8')))
      var newGraph = api.addContinuations(graph, {mode: 'only necessary'})
      expect(newGraph.node('factorial_10:factorial_3').params.isContinuation).to.be.ok
      expect(newGraph.node('factorial_10').params.isContinuation).to.be.true
      expect(newGraph.node('factorial_10:mux_0').params.continuations).to.eql([
        {node: 'factorial_10:factorial_3', port: 'input2', type: 'recursion'},
        {node: 'factorial_10:multiply_2', port: 'input2', branchPorts: ['m1'], type: 'branching'}
      ])
      expect(newGraph.edges().length).to.equal(graph.edges().length + 2)
    })

    it('creates two continuation for the factorial_if example', () => {
      var graph = grlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/factorial_if.json', 'utf8')))
      var newGraph = api.addContinuations(graph, {mode: 'only necessary'})
      expect(newGraph.node('factorial_10:factorial_5').params.isContinuation).to.be.ok
      expect(newGraph.node('factorial_10').params.isContinuation).to.be.true
      expect(newGraph.node('factorial_10:if_0:mux_0').params.continuations).to.eql([
        {node: 'factorial_10:factorial_5', port: 'input2', type: 'recursion'},
        {node: 'factorial_10:multiply_4', port: 'input2', branchPorts: ['m1'], type: 'branching'}
      ])
      expect(newGraph.edges().length).to.equal(graph.edges().length + 2)
    })

    it('steps into compounds to look for muxes', () => {
      var sel = grlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/selsort.json', 'utf8')))
      var cnts = api.continuationsForMux(sel, 'selectionsort_37:min_27:if_14:mux_0')
      expect(cnts.continuations).to.have.length(1)
      expect(cnts.continuations[0].node).to.equal('selectionsort_37:min_27:if_17:mux_0')
    })

    it('processes multiple paths correctly', () => {
      var sel = grlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/selsort.json', 'utf8')))
      var cnts = api.continuationsForMux(sel, 'selectionsort_37:min_27:if_17:mux_0')
      expect(cnts.continuations).to.have.length(1)
    })

    it('processes multiple paths correctly', () => {
      var sel = grlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/selsort.json', 'utf8')))
      var cnts = api.continuationsForMux(sel, 'selectionsort_37:min_27:if_17:mux_0', {includeControl: true})
      expect(cnts.continuations).to.have.length(3)
    })

    it('creates one dependent continuation for the successor of the factorial recursion', () => {
      var graph = grlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/factorial.json', 'utf8')))
      var newGraph = api.addContinuations(graph, {mode: 'only necessary'})
      expect(newGraph.node('factorial_10:multiply_2').params.isContinuation).to.be.an('object')
    })

    it('creates three continuation for the ackermann example', () => {
      var graph = grlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/ack.json', 'utf8')))
      var newGraph = api.addContinuations(graph, {mode: 'only necessary'})
      expect(newGraph.node('ack_20:ack_11').params.isContinuation).to.be.ok
      expect(newGraph.node('ack_20:ack_4').params.isContinuation).to.be.ok
      expect(newGraph.node('ack_20').params.isContinuation).to.be.true
      expect(newGraph.node('ack_20:mux_0').params.continuations).to.deep.equal([{node: 'ack_20:mux_3', port: 'input2'}])
      /* expect(newGraph.node('defco_ack:mux_3').params.continuations).to.include('defco_ack:ack_11')
      expect(newGraph.node('defco_ack:mux_3').params.continuations).to.include('defco_ack:ack_4')*/
      expect(newGraph.edges().length).to.equal(graph.edges().length + 4)
      expect(newGraph.edge({v: 'ack_20:mux_0', w: 'ack_20:mux_3', name: 'ack_20:mux_0→→ack_20:mux_3@input2'})).to.be.ok
      expect(newGraph.edge({v: 'ack_20:mux_0', w: 'ack_20:mux_3', name: 'ack_20:mux_0→→ack_20:mux_3@input2'}).continuation).to.be.true
    })

    it('creates two continuations on one path for the quicksort example', () => {
      var graph = grlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/quicksort.json', 'utf8')))
      var cnts = api.continuationsForMux(graph, 'quicksort_37:if_22:mux_0', {mode: 'only necessary'})
      expect(cnts.continuations).to.have.length(3)
    })
  })
})
