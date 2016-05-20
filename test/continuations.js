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
    var paths = api.muxInPortPathes(factorial, 'defco_factorial:mux_0')
    expect(paths).to.be.ok
    expect(paths.input1).to.have.length(1)
    expect(paths.input2).to.have.length(3)
  })

  it('can stops the input path of a mux on another mux', () => {
    var ack = grlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/ack.json')))
    var paths = api.muxInPortPathes(ack, 'defco_ack:mux_0')
    expect(paths).to.be.ok
    expect(paths.input1).to.have.length(2)
    expect(paths.input2).to.have.length(1)
    expect(paths.input2[0]).to.have.length(2)
  })

  it('can find the recursion on a path', () => {
    var factorial = grlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/factorial.json')))
    var paths = api.muxInPortPathes(factorial, 'defco_factorial:mux_0')
    var recursion = api.firstRecursionOnPath(factorial, 'defco_factorial:mux_0', paths.input2[1])
    expect(recursion).to.be.ok
    expect(recursion).to.equal('defco_factorial:factorial_3')
  })

  it('returns undefined if there is no recursion on the path', () => {
    var factorial = grlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/factorial.json')))
    var paths = api.muxInPortPathes(factorial, 'defco_factorial:mux_0')
    var recursion = api.firstRecursionOnPath(factorial, 'defco_factorial:mux_0', paths.input2[0])
    expect(recursion).to.be.undefined
  })
})

describe('Processing paths to multiplexers inputs', () => {
  it('can find recursion in mux paths', () => {
    var factorial = grlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/factorial.json')))
    var cnts = api.continuationsForMux(factorial, 'defco_factorial:mux_0', {mode: 'only necessary'})
    expect(cnts.continuations).to.be.ok
    expect(cnts.continuations).to.have.length(1)
    expect(cnts.continuations[0]).to.eql({node: 'defco_factorial:factorial_3', port: 'input2'})
  })

  it('can finds muxes on mux paths', () => {
    var factorial = grlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/ack.json')))
    var cnts = api.continuationsForMux(factorial, 'defco_ack:mux_0', {mode: 'only necessary'})
    expect(cnts.continuations).to.be.ok
    expect(cnts.continuations).to.have.length(1)
    expect(cnts.continuations[0]).to.eql({node: 'defco_ack:mux_3', port: 'input2'})
  })

  describe('Mode: Only necessary', () => {
    it('does not replace simple cases', () => {
      var graph = grlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/mux.json', 'utf8')))
      var newGraph = api.addContinuations(graph, {mode: 'only necessary'})
      expect(grlib.json.write(newGraph)).to.deep.equal(grlib.json.write(graph))
    })

    it('creates one continuation for the factorial example', () => {
      var graph = grlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/factorial.json', 'utf8')))
      var newGraph = api.addContinuations(graph, {mode: 'only necessary'})
      expect(newGraph.node('defco_factorial:factorial_3').params.isContinuation).to.be.true
      expect(newGraph.node('defco_factorial').params.isContinuation).to.be.true
      expect(newGraph.node('defco_factorial:mux_0').params.continuations).to.deep.equal([{node: 'defco_factorial:factorial_3', port: 'input2'}])
      expect(newGraph.edges().length).to.equal(graph.edges().length + 1)
    })

    it('creates three continuation for the factorial example', () => {
      var graph = grlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/ack.json', 'utf8')))
      var newGraph = api.addContinuations(graph, {mode: 'only necessary'})
      expect(newGraph.node('defco_ack:ack_11').params.isContinuation).to.be.true
      expect(newGraph.node('defco_ack:ack_4').params.isContinuation).to.be.true
      expect(newGraph.node('defco_ack').params.isContinuation).to.be.true
      expect(newGraph.node('defco_ack:mux_0').params.continuations).to.deep.equal([{node: 'defco_ack:mux_3', port: 'input2'}])
      /* expect(newGraph.node('defco_ack:mux_3').params.continuations).to.include('defco_ack:ack_11')
      expect(newGraph.node('defco_ack:mux_3').params.continuations).to.include('defco_ack:ack_4')*/
      expect(newGraph.edges().length).to.equal(graph.edges().length + 3)
      expect(newGraph.edge({v: 'defco_ack:mux_0', w: 'defco_ack:mux_3', name: 'defco_ack:mux_0→→defco_ack:mux_3@input2'})).to.be.ok
      expect(newGraph.edge({v: 'defco_ack:mux_0', w: 'defco_ack:mux_3', name: 'defco_ack:mux_0→→defco_ack:mux_3@input2'}).continuation).to.be.true
    })
  })
})
