import { postEvent } from './post-event'
import { EventsStorage } from './events-storage'
import {
  projectEvent,
  sessionEvent,
  cliCommandEvent,
  dependencyEvent,
  configEvent,
  buildEvent,
  ssgEvent
} from './events'
import { createContext, getEventContext } from './utils/context'

const eventsMap = {
  NUXT_PROJECT: projectEvent,
  NUXT_SESSION: sessionEvent,
  NUXT_CLI_COMMAND: cliCommandEvent,
  NUXT_DEPENDENCY: dependencyEvent,
  NUXT_CONFIG: configEvent,
  NUXT_BUILD: buildEvent,
  NUXT_SSG: ssgEvent
}

export class Telemetry {
  events
  options
  nuxt
  storage = new EventsStorage()

  constructor(nuxt) {
    this.nuxt = nuxt
    this.options = nuxt.options
  }

  // Lazy async memorizing :D
  getContext() {
    if (!this._contextPromise) {
      this._contextPromise = createContext(this.nuxt)
    }
    return this._contextPromise
  }

  processEvent(eventName, data) {
    const event = eventsMap[eventName]
    if (typeof event !== 'function') {
      console.warn('Event not found:' + eventName)
      return
    }
    this.storage.addEventToQueue(this._invokeEvent(event, data))
  }

  async _invokeEvent(event, data) {
    try {
      const context = await this.getContext()
      await event(context, data)
    } catch (err) {
      console.error('Error while running event:', event, err)
    }
  }

  async recordEvents() {
    const fulfilledEvents = await this.storage
      .completedEvents()
      .then((events) =>
        events
          .filter((e) => e.status === 'fulfilled')
          .map((e) => e.value)
          .flat()
      )

    if (fulfilledEvents.length) {
      const context = await this.getContext()

      await postEvent(
        {
          body: {
            createdAt: new Date(),
            context: getEventContext(context),
            events: fulfilledEvents
          }
        },
        { options: this.options }
      )
    }
  }
}