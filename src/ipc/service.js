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
 * @interface IPCService
 * 
 */
/**
 * Register receiver function with service interface
 * 
 * @function IPCService#addReceiver
 * 
 * @params {function} receiver Interface function implementation
 */
/**
 * Perform service API setup completion and signal remote clients
 * that API is setup and ready.
 * 
 * @function IPCService#ready
 * 
 */
/**
 * Query remote end-point and return service interface specification
 * 
 * @function IPCService#getLocalInterface
 * 
 * @returns {Interface} Local client API interface
 */

var __context
var __services = {}

/**
 * Initialize vault-api IPC service API
 * 
 * @access private
 * 
 * @param {Vault} vault Vault API instance
 */
export function init (vault) {
  __context = vault
}

/**
 * Create a local service for remote IPC method calls.
 *
 * @access private
 * 
 * @param {string} tag Local service descriptor
 */
export function register (tag) {
  if (tag in __services) throw "IPC_TAG_IN_USE"

  console.info('VAULT-API-IPC (Service): Attempting to register service:', tag)

  __services[tag] = {
    getInterface: getInterface(tag)
  }

  return {
    addReceiver: addReceiver(tag),
    ready: serviceReady(tag),
    getLocalInterface: getLocalInterface(tag)
  }
}

/**
 * Register a receiver function for remote IPC method calls.
 *
 * @access private
 * 
 * @param {string} tag Local service descriptor
 */
function addReceiver (tag) {
  return function (f) {
    console.info('VAULT-API-IPC (Service): Adding "' + tag + '" receiver:', f.name)
    const service = __services[tag]
    service[f.name] = f
  }
}

/**
 * Signal service is ready for use by remote end-points.
 *
 * @access private
 * 
 * @param {string} tag Local service descriptor
 */
function serviceReady (tag) {
  return function (f) {
    console.info('VAULT-API-IPC (Service): Sending "' + tag + '" ready.')
    __context.message({ IPCRouterRequest: { target: window.origin, callback: 'init-' + window.origin }})
  }
}

/**
 * Get service interface
 * 
 * @access private
 * 
 * @param {string} tag Local service descriptor
 */
function getInterface (tag) {
  return function () {
    console.info('VAULT-API-IPC (Service): getInterface('+tag+')')

    const service = __services[tag]
    return Object.keys(service)
      .filter(v => v !== 'getInterface')
      .map(v => ({ type: 'method', name: v, arity: service[v].length }))
  }
}

/**
 * Get service local API instance.
 * 
 * @access private
 * 
 * @param {string} tag Local service descriptor
 */
function getLocalInterface (tag) {
  return function () {
    const iface = {}
    const service = __services[tag]

    iface.origin = window.origin

    Object.keys(service).forEach(k => {
      iface[k] = service[k].bind(iface)
    })

    return iface
  }
}

/**
 * Takes incoming message events, and if it's a local service API request,
 * invokes appropriate service receiver function.
 * 
 * @access private
 * 
 * @param {MessageEvent} ev 
 */
export async function dispatch (ev) {
  if (!ev.data.tag) return
  if (!ev.data.call) return

  console.info('VAULT-API-IPC (Service): Message received:', ev)

  const service = __services[ev.data.tag]
  if (!service) {
    console.warn('VAULT-API-IPC (Service): Unrecognised service tag:', ev.data.tag)
    return
  }

  const receiver = service[ev.data.call]
  if (!receiver) {
    console.warn('VAULT-API-IPC (Service): Unrecognised service receiver:', ev.data.call)
    return
  }

  try {
    var response = await receiver.apply({
        origin: ev.data.origin
      }, ev.data.args)
  } catch (e) {
    console.warn('VAULT-API-IPC (Service): Error calling receiver:', e)
    return ev.source.postMessage({
      IPCRouterRequest: {
        target: window.origin,
        callback: ev.data.callback,
        error: '' + e
      }
    }, ev.origin)
  }

  ev.source.postMessage({
    IPCRouterRequest: {
      target: window.origin,
      callback: ev.data.callback,
      result: response
    }
  }, ev.origin)
}
