/**
 * Created by liekkas on 16/6/16.
 *
 * 获取部分信息,推荐使用
 */
import request from 'request'
import cheerio from 'cheerio'
import fs from 'fs'
import {mkdir, readJSONFile} from '../tools/zfile'

const URL = 'http://drama.pili.com.tw'
const JT2FT_URL = 'http://tool.lu/zhconvert/ajax.html' //繁体转简体服务地址

let ALL_GROUP = [] //所有组织
let ALL_ROLES = [] //所有角色

let IMAGE_CACHE = [] //缓存需要保存的图片信息

const RESULT_FILE = 'pili2.json' //最终保存文件路径
const IMAGE_GROUP = 'images/group'  //组织头像保存路径
const IMAGE_ROLE_SMALL = 'images/role/small' //人物小头像保存路径
const IMAGE_ROLE_MID = 'images/role/mid' //人物正面像保存路径

//繁体转简体
function translate(input) {
//  console.log('>>> translate begin')
  return new Promise((resolve, reject) =>
    request.post({url: JT2FT_URL, form: {code: input, operate: 'zh-hans'}}, (err, res, body) => {
//      console.log('>>> translate end')
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
    if (index < ALL_GROUP.length) continue
//    if (index !== 0) break

    let group
    const field = cheerio.load(item)
    const image = URL + field('img').attr('src')
    const imageStr = image.split('/group/image/')[1]
    const name = imageStr.substring(0, imageStr.length - 4)
    const label = field('h4').text().trim()
    const url = URL + field('a').attr('href')
    group = {id: ALL_GROUP.length, name, label}

    //保存组织头像
    IMAGE_CACHE.push({from: image, to: `${IMAGE_GROUP}/${imageStr}`})

    //获取组织详情
    const singleGroupPage = await fetchSingleGroupPage(url)
    const translatePage = await translate(singleGroupPage)
    const other = await parseSingleGroupPage(translatePage, name)
    ALL_GROUP.push({...group, ...other})
    await saveData()
    console.log(`>>> 已解析完组织【${label}】`)
  }
  console.log('>>> parseGroupsPage end')
}

async function parseSingleGroupPage(pageHtml, groupName) {
  let group = {}
  const $ = cheerio.load(pageHtml)

  const members = $('#group_member > .group_field') //组织人员
  //遍历组织人员信息
  const entries = Array.from(members).entries() //获取iterator接口
  let _members = []
  for (let [index, item] of entries) {
//    if (index > 0) break
    const member = cheerio.load(item)
    const title = member('.group_tag').text().trim()
    const roles = member('.group_fdata > ul li')
    //遍历组织人员信息
    const entries = Array.from(roles).entries() //获取iterator接口
    for (let [i, t] of entries) {
      const id = ALL_ROLES.length
      const role = cheerio.load(t)
      const roleUrl = role('a').attr('href')
      const label = role('p').text().trim()
      const smallImg = URL+role('img').attr('src')
      const roleEnStr = smallImg.split('/role/image/small/')[1]
      const name = roleEnStr.substring(0, roleEnStr.length - 4)
//      console.log('f',name, label, roleUrl, smallImg)
      _members.push(name)

      //保存人物小头像
      IMAGE_CACHE.push({from: smallImg, to: `${IMAGE_ROLE_SMALL}/${roleEnStr}`})

      if (roleUrl !== undefined) {
        const page = await fetchSingleRolePage(URL+roleUrl)
        const translatePage = await translate(page)
        const other = parseRolePage(translatePage)
        ALL_ROLES.push({id, name, label, group: groupName, ...other})
      } else {
        ALL_ROLES.push({id, name, label, group: groupName})
      }
      console.log(`已解析完人物【${label}】`)
    }
  }
  group.members = _members
  return group
}

function parseRolePage(body){
  let role = {}
  const $ = cheerio.load(body)
  const image = URL+$('#role_base_image').attr('src')
  const imageName = image.split('/role/image/main_')[1]

  //保存人物正面像
  IMAGE_CACHE.push({from: image, to: `${IMAGE_ROLE_MID}/${imageName}`})

  const relation = $('#role_relation > .role_field') //人际关系
  let _relation = {}
  relation.map((index, item) => {
    const field = cheerio.load(item)
    const fieldKey = field('.role_tag').text().trim().replace('/', '')
    const links = field('.role_fdata > a')
    let arr = []
    links.map((index, item) => {
      const field = item.attribs.href.split('/')[2]
      arr.push(field)
    })
    if (fieldKey !== '组织门派') {
      _relation[fieldKey] = arr
    }
  })
  role.relation = _relation

  console.log('>>> parseRolePage end')
  return role
}

//初始化数据:获取已经完成的数据,并建立相关文件夹
function initData() {
  console.log('>>> 初始化数据')
  mkdir([IMAGE_GROUP,IMAGE_ROLE_MID, IMAGE_ROLE_SMALL]) //
  return new Promise((resolve, reject) =>
    fs.readFile(RESULT_FILE, (err, body) => err ? reject(err) : resolve(JSON.parse(body)))
  )
}

//每解析完一个组织,保存一下数据
function saveData() {
  IMAGE_CACHE.forEach(({from, to}) => { //如果没有则保存头像
    fs.exists(to, v => {
      if (!v) request(from).pipe(fs.createWriteStream(to))
    })
  })
  IMAGE_CACHE = []
  const result = JSON.stringify({groups: ALL_GROUP, roles: ALL_ROLES})
  return new Promise((resolve, reject) =>
    fs.writeFile(RESULT_FILE, result, (err, body) => err ? reject(err) : resolve(true))
  )
}

async function start() {
  console.log('>>> parse start')
  const data = await initData()
  ALL_GROUP = data.groups
  ALL_ROLES = data.roles
  console.log(`>>> 已完成组织${ALL_GROUP.length}个,完成角色${ALL_ROLES.length}个`)
  const groupPage = await fetchGroupsPage()
  const translatePage = await translate(groupPage)
  await parseGroupsPage(translatePage)

  console.log('>>> parse end:')
}

start()
