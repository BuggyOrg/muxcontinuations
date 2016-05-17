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
    var continuations = api.continuationsForMux(factorial, 'defco_factorial:mux_0', {mode: 'only necessary'})
    expect(continuations).to.be.ok
    expect(continuations).to.have.length(1)
    expect(continuations[0]).to.equal('defco_factorial:factorial_3')
  })

  it('can finds muxes on mux paths', () => {
    var factorial = grlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/ack.json')))
    var continuations = api.continuationsForMux(factorial, 'defco_ack:mux_0', {mode: 'only necessary'})
    expect(continuations).to.be.ok
    expect(continuations).to.have.length(1)
    expect(continuations[0]).to.equal('defco_ack:mux_3')
  })

  describe('Mode: Only necessary', () => {
    /* it('does not replace simple cases', () => {
      var graph = grlib.json.read(JSON.parse(fs.readFileSync('test/fixtures/mux.json', 'utf8')))
      var newGraph = api.demuxify(graph, {mode: 'only necessary'})
      expect(grlib.json.write(newGraph)).to.deep.equal(grlib.json.write(graph))
    })*/
  })
})
