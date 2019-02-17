/*
 * Copyright (c) 2019 Zippie Ltd.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */
/**
 * Interface for accessing a remote IPC end-point
 * 
 * @interface IPCClient
 * 
 */
/** @member {string} IPCClient#uri */
/** @member {string} IPCClient#tag */
/**
 * Query remote end-point and return service interface specification
 * 
 * @function IPCClient#getInterface
 * @returns {InterfaceSpec} Remote IPC interface specification
 */

var __context
var __clients = {}

/**
 * Initialize vault-api IPC client API
 * 
 * @access private
 * 
 * @param {Vault} vault Vault API instance
 */
export function init (vault) {
  __context = vault
}

/**
 * Connect to a remote IPC end-point through vault.
 * 
 * @access private
 * 
 * @param {string} uri Remote application host uri
 * @param {string} tag Remote application service descriptor
 */
export function connect (uri, tag) {
  const serviceId = tag+'+'+uri

  if (serviceId in __clients) return __clients[serviceId]

  console.info('VAULT-API-IPC (CLIENT): Connecting to remote service:', serviceId)

  // Send IPC init request to vault, to connect to remote end-point.
  // Once connected, call 'getInterface' to get remote service interface spec.
  // Then dynamically construct API based on interface spec.
  return message(uri, tag, 'init')
    .then(queue(uri, tag, 'getInterface', []))
    .then(iface => {
      const inst = {
        uri,
        tag,
        getInterface: method(uri, tag, 'getInterface', 0),
      }

      // Auto-generate remote IPC client interface.
      // XXX - Currently only 'method' type supported, need 'event' type, etc.
      iface.forEach(v => {
        if (v.type === 'method') {
          console.info('VAULT-API-IPC (CLIENT): Generating method:', serviceId, v.name, v.arity)
          inst[v.name] = method(uri, tag, v.name, v.arity)
        }

        if (v.type === 'event') {
          console.info('VAULT-API-IPC (CLIENT): Ignoring event type (not implemented yet!):', serviceId, v.name)
        }
      })

      __clients[serviceId] = inst
      return inst
    })
}

/**
 * Call a remote IPC end-point method with parameters.
 * 
 * @access private
 * 
 * @param {string} endpoint Remote application host uri
 * @param {string} tag Remote application service descriptor
 * @param {string} call Method name
 * @param {Array} args Method parameters
 */
function message (endpoint, tag, call, args) {
  return __context.message({
      IPCRouterRequest: {
        target: endpoint,
        payload: {call: call, args: args, tag: tag}
    }})
}

/**
 * Create a continuation which when invoked calls a remote IPC end-point method.
 * Useful when chaining promises.
 * 
 * @access private
 * 
 * @param {string} endpoint Remote application host uri
 * @param {string} tag Remote application service descriptor
 * @param {string} call Method name
 * @param {Array} args Method parameters
 */
function queue (endpoint, tag, method, args) {
  return function () { return message(endpoint, tag, method, args) }
}

/**
 * Create a remote IPC method call interface method.
 * Used for constructing dynamic IPC client interfaces.
 * 
 * @access private
 * 
 * @param {string} endpoint Remote application host uri
 * @param {string} tag Remote application service descriptor
 * @param {string} call Method name
 * @param {Integer} arity 
 */
function method (endpoint, tag, method, arity) {
  return function () {
    if (arguments.length < arity) throw 'INVALID_PARAMS'

    return message.apply(
      null,
      [endpoint, tag, method, [Array.prototype.slice.call(arguments)]]
    )
  }
}