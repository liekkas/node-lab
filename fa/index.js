/**
 * Created by liekkas on 16/6/23.
 */
import request from 'request'
import cheerio from 'cheerio'
import fs from 'fs'

const URL = 'http://fontawesome.io/cheatsheet/'

function fetchPage() {
  console.log('>>> fetchPage begin')
  return new Promise((resolve, reject) =>
    request(URL, (err, res, body) => {
      console.log('>>> fetchPage end')
      return err ? reject(err) : resolve(body)
    })
  )
}

async function start() {
  console.log('>>> parse start')
  const pageHtml = await fetchPage()
  const $ = cheerio.load(pageHtml)
  const other = $('.col-lg-3') //物品
  other.map((index, item) => {
    const field = cheerio.load(item)
    const fieldKey = field('.fa').attr('title').trim().split('Copy to use ')[1]
    const fieldValue = _.words(field('span').text().trim()).join('').replace('x', '\\u')
    console.log('>>> item: ',fieldKey, fieldValue)
  })
  console.log('>>> end')
//
//  const fas = $('.col-lg-3')
//
//  let result = []
//  fas.map((index, item) => {
//    const field = cheerio.load(item)
//    const fieldKey = field('.fa').attr('title').trim().split('Copy to use ')[1]
//    const fieldValue = _.words(field('span').text().trim()).join('').replace('x', '\\u')
//    result.push({name: fieldKey, code: fieldValue})
//    console.log('>>> parse...', index, fieldKey)
//  })
  fs.writeFile('./result.json', JSON.stringify(result))
  console.log('>>> parse end')
}

start()
