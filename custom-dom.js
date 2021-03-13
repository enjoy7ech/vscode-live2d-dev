let div = document.createElement('div')
div.id = 'custom-area'

let ul = document.createElement('ul')
ul.classList.add('circles')
for (let i = 0; i < 10; i++) {
  let li = document.createElement('li')
  ul.append(li)
}

div.append(ul)

document.body.append(div)
