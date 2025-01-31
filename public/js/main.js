(function () {
  "use strict";

  /**
   * Apply .scrolled class to the body as the page is scrolled down
   */
  function toggleScrolled() {
    const selectBody = document.querySelector('body');
    const selectHeader = document.querySelector('#header');
    if (!selectHeader.classList.contains('scroll-up-sticky') && !selectHeader.classList.contains('sticky-top') && !selectHeader.classList.contains('fixed-top')) return;
    window.scrollY > 100 ? selectBody.classList.add('scrolled') : selectBody.classList.remove('scrolled');
  }

  document.addEventListener('scroll', toggleScrolled);
  window.addEventListener('load', toggleScrolled);

  /**
   * Mobile nav toggle
   */
  const mobileNavToggleBtn = document.querySelector('.mobile-nav-toggle');

  function mobileNavToggle() {
    document.querySelector('body').classList.toggle('mobile-nav-active');
    mobileNavToggleBtn.classList.toggle('bi-list');
    mobileNavToggleBtn.classList.toggle('bi-x');
  }
  if (mobileNavToggleBtn) {
    mobileNavToggleBtn.addEventListener('click', mobileNavToggle);
  }

  /**
   * Hide mobile nav on same-page/hash links
   */
  document.querySelectorAll('#navmenu a').forEach(navmenu => {
    navmenu.addEventListener('click', () => {
      if (document.querySelector('.mobile-nav-active')) {
        mobileNavToggle();
      }
    });
  });

  /**
   * Toggle mobile nav dropdowns
   */
  document.querySelectorAll('.navmenu .toggle-dropdown').forEach(navmenu => {
    navmenu.addEventListener('click', function (e) {
      e.preventDefault();
      this.parentNode.classList.toggle('active');
      this.parentNode.nextElementSibling.classList.toggle('dropdown-active');
      e.stopImmediatePropagation();
    });
  });

  /**
   * Preloader
   */
  const preloader = document.querySelector('#preloader');
  if (preloader) {
    window.addEventListener('load', () => {
      preloader.remove();
    });
  }

  /**
   * Scroll top button
   */
  let scrollTop = document.querySelector('.scroll-top');

  function toggleScrollTop() {
    if (scrollTop) {
      window.scrollY > 100 ? scrollTop.classList.add('active') : scrollTop.classList.remove('active');
    }
  }
  if (scrollTop) {
    scrollTop.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });

    window.addEventListener('load', toggleScrollTop);
    document.addEventListener('scroll', toggleScrollTop);
  }

  /**
   * Animation on scroll function and init
   */
  function aosInit() {
    AOS.init({
      duration: 600,
      easing: 'ease-in-out',
      once: true,
      mirror: false
    });
  }
  window.addEventListener('load', aosInit);

  /**
   * Initiate glightbox
   */
  const glightbox = GLightbox({
    selector: '.glightbox'
  });

  /**
   * Init isotope layout and filters
   */
  document.querySelectorAll('.isotope-layout').forEach(function (isotopeItem) {
    let layout = isotopeItem.getAttribute('data-layout') ?? 'masonry';
    let filter = isotopeItem.getAttribute('data-default-filter') ?? '*';
    let sort = isotopeItem.getAttribute('data-sort') ?? 'original-order';

    let initIsotope;
    imagesLoaded(isotopeItem.querySelector('.isotope-container'), function () {
      initIsotope = new Isotope(isotopeItem.querySelector('.isotope-container'), {
        itemSelector: '.isotope-item',
        layoutMode: layout,
        filter: filter,
        sortBy: sort
      });
    });

    isotopeItem.querySelectorAll('.isotope-filters li').forEach(function (filters) {
      filters.addEventListener('click', function () {
        isotopeItem.querySelector('.isotope-filters .filter-active').classList.remove('filter-active');
        this.classList.add('filter-active');
        initIsotope.arrange({
          filter: this.getAttribute('data-filter')
        });
        if (typeof aosInit === 'function') {
          aosInit();
        }
      }, false);
    });

  });

  /**
   * Init swiper sliders
   */
  function initSwiper() {
    document.querySelectorAll(".init-swiper").forEach(function (swiperElement) {
      let config = JSON.parse(
        swiperElement.querySelector(".swiper-config").innerHTML.trim()
      );

      if (swiperElement.classList.contains("swiper-tab")) {
        initSwiperWithCustomPagination(swiperElement, config);
      } else {
        new Swiper(swiperElement, config);
      }
    });
  }

  window.addEventListener("load", initSwiper);

  /**
   * Correct scrolling position upon page load for URLs containing hash links.
   */
  window.addEventListener('load', function (e) {
    if (window.location.hash) {
      if (document.querySelector(window.location.hash)) {
        setTimeout(() => {
          let section = document.querySelector(window.location.hash);
          let scrollMarginTop = getComputedStyle(section).scrollMarginTop;
          window.scrollTo({
            top: section.offsetTop - parseInt(scrollMarginTop),
            behavior: 'smooth'
          });
        }, 100);
      }
    }
  });

  /**
   * Navmenu Scrollspy
   */
  let navmenulinks = document.querySelectorAll('.navmenu a');

  function navmenuScrollspy() {
    navmenulinks.forEach(navmenulink => {
      if (!navmenulink.hash) return;
      let section = document.querySelector(navmenulink.hash);
      if (!section) return;
      let position = window.scrollY + 200;
      if (position >= section.offsetTop && position <= (section.offsetTop + section.offsetHeight)) {
        document.querySelectorAll('.navmenu a.active').forEach(link => link.classList.remove('active'));
        navmenulink.classList.add('active');
      } else {
        navmenulink.classList.remove('active');
      }
    })
  }
  window.addEventListener('load', navmenuScrollspy);
  document.addEventListener('scroll', navmenuScrollspy);

})();

/**
 * Dashboard Interactions
 */
document.addEventListener('DOMContentLoaded', () => {
  /**
   * Inicializar os toasts
   */
  const toastElList = [].slice.call(document.querySelectorAll('.toast'))
  const toastList = toastElList.map(function (toastEl) {
    return new bootstrap.Toast(toastEl, { delay: 5000 }) // Exibir por 5 segundos
  })

  /**
   * Função para exibir toast
   */
  window.showToast = function (title, message, type = 'info') {
    const toastTitle = document.getElementById('toast-title')
    const toastBody = document.getElementById('toast-body')
    const liveToast = new bootstrap.Toast(document.getElementById('liveToast'))

    // Atualizar o conteúdo do toast
    toastTitle.textContent = title
    toastBody.textContent = message

    // Atualizar a classe do toast para cores diferentes
    const toastHeader = document.querySelector('#liveToast .toast-header')
    toastHeader.className = 'toast-header'

    switch (type) {
      case 'success':
        toastHeader.classList.add('bg-success', 'text-white')
        break
      case 'error':
        toastHeader.classList.add('bg-danger', 'text-white')
        break
      case 'warning':
        toastHeader.classList.add('bg-warning', 'text-dark')
        break
      case 'info':
      default:
        toastHeader.classList.add('bg-info', 'text-white')
    }

    // Exibir o toast
    liveToast.show()
  }

  /**
   * Variáveis para o modal de confirmação
   */
  let actionType = ''
  let targetUserId = null

  /**
   * Função para abrir o modal de confirmação
   */
  function openConfirmModal(type, userId) {
    actionType = type
    targetUserId = userId

    const confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'))
    const confirmModalBody = document.getElementById('confirmModalBody')
    const confirmActionBtn = document.getElementById('confirmActionBtn')

    if (type === 'approve') {
      confirmModalBody.textContent = 'Tem certeza que deseja aprovar este usuário?'
      confirmActionBtn.classList.remove('btn-danger', 'btn-warning')
      confirmActionBtn.classList.add('btn-success')
      confirmActionBtn.textContent = 'Aprovar'
    } else if (type === 'delete') {
      confirmModalBody.textContent = 'Tem certeza que deseja deletar este usuário? Esta ação não pode ser desfeita.'
      confirmActionBtn.classList.remove('btn-success', 'btn-warning')
      confirmActionBtn.classList.add('btn-danger')
      confirmActionBtn.textContent = 'Deletar'
    }

    confirmModal.show()
  }

  /**
   * Adicionar eventos aos botões de Aprovar e Deletar para abrir o modal
   */
  const approveButtons = document.querySelectorAll('.approve-user')
  approveButtons.forEach(button => {
    button.addEventListener('click', () => {
      const userId = button.getAttribute('data-user-id')
      openConfirmModal('approve', userId)
    })
  })

  const deleteButtons = document.querySelectorAll('.delete-user')
  deleteButtons.forEach(button => {
    button.addEventListener('click', () => {
      const userId = button.getAttribute('data-user-id')
      openConfirmModal('delete', userId)
    })
  })

  /**
   * Manipular o botão de confirmação no modal
   */
  const confirmActionBtn = document.getElementById('confirmActionBtn')
  if (confirmActionBtn) {
    confirmActionBtn.addEventListener('click', () => {
      if (actionType === 'approve' && targetUserId) {
        // Aprovar usuário
        fetch(`/approve_user/${targetUserId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': getCsrfToken()
          }
        })
          .then(response => response.json())
          .then(data => {
            if (data.success) {
              // Atualizar a linha do usuário
              const userRow = document.getElementById(`user-row-${targetUserId}`)
              if (userRow) {
                userRow.querySelector('td:nth-child(5)').textContent = 'Sim'
                // Remover o botão de aprovar
                const approveBtn = userRow.querySelector('.approve-user')
                if (approveBtn) approveBtn.remove()
              }
              // Exibir toast de sucesso
              showToast('Sucesso', data.message, 'success')
            } else {
              // Exibir toast de erro
              showToast('Erro', data.message, 'error')
            }
          })
          .catch(error => {
            console.error('Erro:', error)
            showToast('Erro', 'Ocorreu um erro ao aprovar o usuário.', 'error')
          })
      } else if (actionType === 'delete' && targetUserId) {
        // Deletar usuário
        fetch(`/delete_user/${targetUserId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': getCsrfToken()
          }
        })
          .then(response => response.json())
          .then(data => {
            if (data.success) {
              // Remover a linha do usuário
              const userRow = document.getElementById(`user-row-${targetUserId}`)
              if (userRow) userRow.remove()
              // Exibir toast de sucesso
              showToast('Sucesso', data.message, 'success')
            } else {
              // Exibir toast de erro
              showToast('Erro', data.message, 'error')
            }
          })
          .catch(error => {
            console.error('Erro:', error)
            showToast('Erro', 'Ocorreu um erro ao deletar o usuário.', 'error')
          })
      }

      // Fechar o modal
      const confirmModalInstance = bootstrap.Modal.getInstance(document.getElementById('confirmModal'))
      if (confirmModalInstance) {
        confirmModalInstance.hide()
      }
    })
  }

  /**
   * Função para obter o token CSRF
   */
  function getCsrfToken() {
    const csrfInput = document.querySelector('input[name="_csrf"]')
    return csrfInput ? csrfInput.value : ''
  }

  /**
   * Ações Rápidas de Dashboard
   * (Se houver ações rápidas adicionais, você pode adicioná-las aqui)
   */

  /**
   * Atualizar logs quando o botão é clicado
   */
  const refreshButton = document.getElementById('refresh-logs')
  if (refreshButton) {
    refreshButton.addEventListener('click', () => {
      fetchActivityLogs()
      showToast('Atualizado', 'Logs de atividade atualizados.', 'success')
    })
  }
});
