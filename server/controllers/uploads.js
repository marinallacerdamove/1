'use strict'

/* global wiki */

module.exports = false
return

const express = require('express')
const router = express.Router()

const readChunk = require('read-chunk')
const fileType = require('file-type')
const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs-extra'))
const path = require('path')
const _ = require('lodash')

const validPathRe = new RegExp('^([a-z0-9/-' + wiki.data.regex.cjk + wiki.data.regex.arabic + ']+\\.[a-z0-9]+)$')
const validPathThumbsRe = new RegExp('^([a-z0-9]+\\.png)$')

// ==========================================
// SERVE UPLOADS FILES
// ==========================================

router.get('/t/*', (req, res, next) => {
  let fileName = req.params[0]
  if (!validPathThumbsRe.test(fileName)) {
    return res.sendStatus(404).end()
  }

  // todo: Authentication-based access

  res.sendFile(fileName, {
    root: wiki.disk.getThumbsPath(),
    dotfiles: 'deny'
  }, (err) => {
    if (err) {
      res.status(err.status).end()
    }
  })
})

router.post('/img', wiki.disk.uploadImgHandler, (req, res, next) => {
  let destFolder = _.chain(req.body.folder).trim().toLower().value()

  wiki.upl.validateUploadsFolder(destFolder).then((destFolderPath) => {
    if (!destFolderPath) {
      res.json({ ok: false, msg: wiki.lang.t('errors:invalidfolder') })
      return true
    }

    Promise.map(req.files, (f) => {
      let destFilename = ''
      let destFilePath = ''

      return wiki.disk.validateUploadsFilename(f.originalname, destFolder, true).then((fname) => {
        destFilename = fname
        destFilePath = path.resolve(destFolderPath, destFilename)

        return readChunk(f.path, 0, 262)
      }).then((buf) => {
        // -> Check MIME type by magic number

        let mimeInfo = fileType(buf)
        if (!_.includes(['image/png', 'image/jpeg', 'image/gif', 'image/webp'], mimeInfo.mime)) {
          return Promise.reject(new Error(wiki.lang.t('errors:invalidfiletype')))
        }
        return true
      }).then(() => {
        // -> Move file to final destination

        return fs.moveAsync(f.path, destFilePath, { clobber: false })
      }).then(() => {
        return {
          ok: true,
          filename: destFilename,
          filesize: f.size
        }
      }).reflect()
    }, {concurrency: 3}).then((results) => {
      let uplResults = _.map(results, (r) => {
        if (r.isFulfilled()) {
          return r.value()
        } else {
          return {
            ok: false,
            msg: r.reason().message
          }
        }
      })
      res.json({ ok: true, results: uplResults })
      return true
    }).catch((err) => {
      res.json({ ok: false, msg: err.message })
      return true
    })
  })
})

router.post('/file', wiki.disk.uploadFileHandler, (req, res, next) => {
  let destFolder = _.chain(req.body.folder).trim().toLower().value()

  wiki.upl.validateUploadsFolder(destFolder).then((destFolderPath) => {
    if (!destFolderPath) {
      res.json({ ok: false, msg: wiki.lang.t('errors:invalidfolder') })
      return true
    }

    Promise.map(req.files, (f) => {
      let destFilename = ''
      let destFilePath = ''

      return wiki.disk.validateUploadsFilename(f.originalname, destFolder, false).then((fname) => {
        destFilename = fname
        destFilePath = path.resolve(destFolderPath, destFilename)

        // -> Move file to final destination

        return fs.moveAsync(f.path, destFilePath, { clobber: false })
      }).then(() => {
        return {
          ok: true,
          filename: destFilename,
          filesize: f.size
        }
      }).reflect()
    }, {concurrency: 3}).then((results) => {
      let uplResults = _.map(results, (r) => {
        if (r.isFulfilled()) {
          return r.value()
        } else {
          return {
            ok: false,
            msg: r.reason().message
          }
        }
      })
      res.json({ ok: true, results: uplResults })
      return true
    }).catch((err) => {
      res.json({ ok: false, msg: err.message })
      return true
    })
  })
})

router.get('/*', (req, res, next) => {
  let fileName = req.params[0]
  if (!validPathRe.test(fileName)) {
    return res.sendStatus(404).end()
  }

  // todo: Authentication-based access

  res.sendFile(fileName, {
    root: wiki.git.getRepoPath() + '/uploads/',
    dotfiles: 'deny'
  }, (err) => {
    if (err) {
      res.status(err.status).end()
    }
  })
})

module.exports = router
