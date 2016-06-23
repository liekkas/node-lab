/**
 * Created by liekkas on 16/6/16.
 * 信息全
 */
import request from 'request'
import cheerio from 'cheerio'
import fs from 'fs'
import {mkdir, readJSONFile} from '../tools/zfile'

const URL = 'http://drama.pili.com.tw'
const JT2FT_URL = 'http://tool.lu/zhconvert/ajax.html' //繁体转简体服务地址

let ALL_GROUP = [] //所有组织
let ALL_ROLES = [] //所有角色

const RESULT_FILE = 'pili.json' //最终保存文件路径
const IMAGE_GROUP = 'images/group'  //组织头像保存路径
const IMAGE_ROLE_SMALL = 'images/role/small' //人物小头像保存路径
const IMAGE_ROLE_MID = 'images/role/mid' //人物正面像保存路径

//繁体转简体
function translate(input) {
  console.log('>>> translate begin')
  return new Promise((resolve, reject) =>
    request.post({url: JT2FT_URL, form: {code: input, operate: 'zh-hans'}}, (err, res, body) => {
      console.log('>>> translate end')
      return err ? reject(err) : resolve(JSON.parse(body).text)
    })
  )
}

//获取所有组织页面
function fetchGroupsPage() {
  console.log('>>> fetchGroupsPage begin')
  return new Promise((resolve, reject) =>
    request(`${URL}/group/`, (err, res, body) => {
      console.log('>>> fetchGroupsPage end')
      return err ? reject(err) : resolve(body)
    })
  )
}

//获取单个组织页面
function fetchSingleGroupPage(url) {
  console.log('>>> fetchSingleGroupPage begin', url)
  return new Promise((resolve, reject) =>
    request(url, (err, res, body) => {
      console.log('>>> fetchSingleGroupPage end', url)
      return err ? reject(err) : resolve(body)
    })
  )
}

//获取单个角色页面
function fetchSingleRolePage(url) {
  console.log('>>> fetchSingleRolePage begin', url)
  return new Promise((resolve, reject) =>
    request(url, (err, res, body) => {
      console.log('>>> fetchSingleRolePage end', url)
      return err ? reject(err) : resolve(body)
    })
  )
}

//解析所有组织页面
async function parseGroupsPage(pageHtml) {
  console.log('>>> parseGroupsPage begin')
  const $ = cheerio.load(pageHtml)
  const groups = $('#tabs-2 > div ul li') // 获取霹雳所有组织
  //遍历组织信息
  const entries = Array.from(groups).entries() //获取iterator接口
  for (let [index, item] of entries) {
    if (index !== 0) break
    let group
    const field = cheerio.load(item)
    const image = URL + field('img').attr('src')
    const imageStr = image.split('/group/image/')[1]
    const name = imageStr.substring(0, imageStr.length - 4)
    const label = field('h4').text().trim()
    const url = URL + field('a').attr('href')
    group = {id: ALL_GROUP.length, name, label}

    //保存组织头像
    request(image).pipe(fs.createWriteStream(`${IMAGE_GROUP}/${imageStr}`))

    //获取组织详情
    const singleGroupPage = await fetchSingleGroupPage(url)
    const translatePage = await translate(singleGroupPage)
    const other = await parseSingleGroupPage(translatePage, label)
    ALL_GROUP.push({...group, ...other})
  }
  console.log('>>> parseGroupsPage end')
}

async function parseSingleGroupPage(pageHtml, groupName) {
  console.log('>>> parseSingleGroupPage begin')
  let group = {}
  const $ = cheerio.load(pageHtml)
  group.intro = $('p[class=p15h20]').text() //组织介绍
  const characteristic = $('#group_characteristical > .group_field') //组织特色
  let _characters = {}
  characteristic.map((index, item) => {
    const field = cheerio.load(item)
    const fieldName = field('.group_tag b').text() //特色项
    const fieldValue = field('.group_fdata').text() //特色值
    _characters[fieldName] = fieldValue
  })
  group.characters = _characters

  const members = $('#group_member > .group_field') //组织人员
  //遍历组织人员信息
  const entries = Array.from(members).entries() //获取iterator接口
  let _members = {}
  for (let [index, item] of entries) {
//    if (index > 0) break
    const member = cheerio.load(item)
    const title = member('.group_tag').text().trim()
    const roles = member('.group_fdata > ul li')
    //遍历组织人员信息
    const entries = Array.from(roles).entries() //获取iterator接口
    let _roles = []
    for (let [i, t] of entries) {
      const id = ALL_ROLES.length
      const role = cheerio.load(t)
      const roleUrl = role('a').attr('href')
      const label = role('p').text().trim()
      const smallImg = URL+role('img').attr('src')
      const roleEnStr = smallImg.split('/role/image/small/')[1]
      const name = roleEnStr.substring(0, roleEnStr.length - 4)
//      console.log('f',name, label, roleUrl, smallImg)
      _roles.push(label)

      //保存人物小头像
      request(smallImg).pipe(fs.createWriteStream(`${IMAGE_ROLE_SMALL}/${roleEnStr}`))

      if (roleUrl !== undefined) {
        const page = await fetchSingleRolePage(URL+roleUrl)
        const translatePage = await translate(page)
        const other = parseRolePage(translatePage)
        ALL_ROLES.push({id, name, label, group: groupName, ...other})
      } else {
        ALL_ROLES.push({id, name, label, group: groupName})
      }
    }
    _members[title] = _roles
  }
  group.members = _members
  console.log('>>> parseSingleGroupPage end')
  return group
}

function parseRolePage(body){
  console.log('>>> parseRolePage begin')
  let role = {}
  const $ = cheerio.load(body)
  role.intro = $('#role_base_intro').text().trim()
  const image = URL+$('#role_base_image').attr('src')
  const imageName = image.split('/role/image/main_')[1]

  //保存人物正面像
  request(image).pipe(fs.createWriteStream(`${IMAGE_ROLE_MID}/${imageName}`))

  const base = $('#role_base_desc > .role_field_small') //基本信息
  let _base = {}
  base.map((index, item) => {
    const field = cheerio.load(item)
    const fieldKey = field('.role_tag').text().trim()
    const fieldValue = field('span').text().trim()
    _base[fieldKey] = fieldValue
  })
  role.base = _base

  const quote = $('#role_quote > .role_field') //诗号/名言/口头禅
  let _quote = {}
  quote.map((index, item) => {
    const field = cheerio.load(item, {decodeEntities: false})
    const fieldKey = field('.role_tag').text().trim()
    const fieldValues = field('.role_fdata').html().split('<br>') //诗多换行,这里合并为整行字符串
    const fieldValue = fieldValues.reduce((prev, cur) => prev.trim().concat(cur.trim()))
    _quote[fieldKey] = fieldValue
  })
  role.quote = _quote

  const relation = $('#role_relation > .role_field') //人际关系
  let _relation = {}
  relation.map((index, item) => {
    const field = cheerio.load(item)
    const fieldKey = field('.role_tag').text().trim().replace('/', '')
    const fieldValueArr = field('.role_fdata').text().trim().split('、')
    const mapedArr = fieldValueArr.map(v => v.split('(')[0].trim())
    if (fieldKey !== '组织门派') {
      _relation[fieldKey] = mapedArr
    }
  })
  role.relation = _relation

  const skill = $('#role_skill > .role_field') //技能
  let _skill = {}
  skill.map((index, item) => {
    const field = cheerio.load(item)
    const fieldKey = field('.role_tag').text().trim()
    const fieldValue = field('.role_fdata').text().trim()
    _skill[fieldKey] = fieldValue
  })
  role.skill = _skill

  const other = $('#role_object > .role_field') //其它
  let _other = {}
  other.map((index, item) => {
    const field = cheerio.load(item)
    const fieldKey = field('.role_tag').text().trim()
    const fieldValue = field('.role_fdata').text().trim()
    _other[fieldKey] = fieldValue
  })
  role.other = _other

  console.log('>>> parseRolePage end')
  return role
}

async function start() {
  console.log('>>> parse start')
  mkdir([IMAGE_GROUP,IMAGE_ROLE_MID, IMAGE_ROLE_SMALL])
  const groupPage = await fetchGroupsPage()
  const translatePage = await translate(groupPage)
  await parseGroupsPage(translatePage)
  fs.writeFile(RESULT_FILE, JSON.stringify({groups: ALL_GROUP, roles: ALL_ROLES}))
  console.log('>>> parse end:')
//  console.log(ALL_GROUP)
//  console.log(ALL_ROLES)
}

start()
