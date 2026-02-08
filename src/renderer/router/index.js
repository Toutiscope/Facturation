import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue')
  },
  {
    path: '/devis',
    name: 'QuoteList',
    component: () => import('@/views/QuoteList.vue')
  },
  {
    path: '/devis/nouveau',
    name: 'QuoteNew',
    component: () => import('@/views/QuoteForm.vue')
  },
  {
    path: '/devis/:id',
    name: 'QuoteEdit',
    component: () => import('@/views/QuoteForm.vue')
  },
  {
    path: '/factures',
    name: 'InvoiceList',
    component: () => import('@/views/InvoiceList.vue')
  },
  {
    path: '/factures/nouvelle',
    name: 'InvoiceNew',
    component: () => import('@/views/InvoiceForm.vue')
  },
  {
    path: '/factures/:id',
    name: 'InvoiceEdit',
    component: () => import('@/views/InvoiceForm.vue')
  },
  {
    path: '/factures-recues',
    name: 'ReceivedInvoices',
    component: () => import('@/views/ReceivedInvoices.vue')
  },
  {
    path: '/configuration',
    name: 'Settings',
    component: () => import('@/views/Settings.vue')
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
