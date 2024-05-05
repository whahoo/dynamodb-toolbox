import normalizeData from '../lib/normalizeData.js'

import { DocumentClient } from './bootstrap.test.js'

import Table from '../classes/Table/Table.js'
import Entity from '../classes/Entity/Entity.js'

const DefaultTable = new Table({
  name: 'test-table',
  partitionKey: 'pk',
  sortKey: 'sk',
  DocumentClient
})

new Entity({
  name: 'User',
  attributes: {
    pk: { type: 'string', partitionKey: true },
    sk: { type: 'string', sortKey: true },
    set: { type: 'set', setType: 'string', alias: 'set_alias' },
    set_alias2: { type: 'set', setType: 'string', map: 'set2' },
    number: 'number',
    list: { type: 'list', alias: 'list_alias' },
    list_alias2: { type: 'list', map: 'list2' },
    test: 'map',
    linked1: ['sk', 0, { save: true }],
    linked2: ['sk', 1]
  },
  table: DefaultTable
} as const)

const attributes = DefaultTable.User.schema.attributes
const linked = DefaultTable.User.linked

describe('normalizeData', () => {
  it('converts entity input to table attributes', async () => {
    const result = normalizeData()(attributes, linked, {
      pk: 'test',
      set_alias: ['1', '2', '3'],
      number: 1,
      test: { test: true },
      linked1: 'test1',
      linked2: 'test2',
      $remove: 'testx'
    })

    expect(result).toEqual({
      sk: 'test1#test2',
      pk: 'test',
      set: ['1', '2', '3'],
      number: 1,
      test: { test: true },
      linked1: 'test1',
      linked2: 'test2',
      $remove: 'testx'
    })
  })

  it('filter out non-mapped fields', async () => {
    const result = normalizeData()(
      attributes,
      linked,
      { pk: 'test', $remove: 'testx', notAField: 'test123' },
      true
    )

    expect(result).toEqual({
      pk: 'test'
    })
  })

  it('fails on non-mapped fields', async () => {
    expect(() => {
      normalizeData()(attributes, linked, {
        pk: 'test',
        $remove: 'testx',
        notAField: 'test123'
      })
    }).toThrow(`Field 'notAField' does not have a mapping or alias`)
  })

  it('fails when partition, sort key or other required fields have depend attributes not provided', () => {
    const ent = new Entity({
      name: 'Test',
      attributes: {
        pk: { type: 'string', partitionKey: true, default: 'pk'},
        sk: { type: 'string', sortKey: true, dependsOn: ['parent'],
          default: (data: { parent: string }) => `parent#${data.parent}`,
        },
        parent: { type: 'string'},
      },
      table: DefaultTable
    } as const)

    expect(() => ent.updateParams({})).toThrow(
      `Required field 'sk' depends on attribute(s), one or more of which can't be resolved (parent)`
    )
  })

  it('should not fail for GSI keys', () => {

    const indexedStatus = ['AVAILABLE', 'PENDING'];

    const ent = new Entity({
      name: 'Test',
      attributes: {
        pk: { type: 'string', partitionKey: true },
        sk: { type: 'string', sortKey: true },
        GSI1PK: { 
          type: 'string', 
          partitionKey: 'GSI1', 
          dependsOn: ['status'],
          default: (data: { status: string }) => data.status in indexedStatus ? `SHOW` : undefined,
        },
        GSI1SK: {
          type: 'string',
          sortKey: 'GSI1',
          dependsOn: ['status', 'modified'],
          default: (data: { status: string, modified: string }) => `${data.status}#${data.modified}`,
        },
        status: { type: 'string' },
      },
      table: DefaultTable,
    } as const)

    expect(() => ent.updateParams({ pk: 'pk', sk: 'sk' })).not.toThrow()
  })
})
