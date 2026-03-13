/**
 * D2C Mobile Nav Drawer
 * Lazy — does nothing until hamburger is tapped.
 */
(function () {
    var nav = {
        d: null,
        o: null,

        toggle: function () {
            if (!this.d) this.build();
            var open = this.d.style.right === '0px';
            this.d.style.right = open ? '-300px' : '0';
            this.o.style.display = open ? 'none' : 'block';
        },

        build: function () {
            var self = this;

            var o = document.createElement('div');
            o.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:1999;display:none;';
            o.onclick = function () { self.toggle(); };
            document.body.appendChild(o);
            this.o = o;

            var d = document.createElement('div');
            d.style.cssText = 'position:fixed;top:0;right:-300px;width:300px;max-width:85vw;height:100%;background:#fff;box-shadow:-10px 0 30px rgba(0,0,0,0.1);z-index:2000;transition:right 0.3s ease;display:flex;flex-direction:column;overflow-y:auto;';

            var h = '<div style="padding:1.25rem 1.5rem;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;"><span style="font-weight:800;font-size:1.1rem;">Menu</span><span onclick="D2C_NAV.toggle()" style="cursor:pointer;font-size:1.5rem;">✕</span></div><div>';

            var links = document.querySelectorAll('.nav-links > a');
            for (var i = 0; i < links.length; i++) {
                h += '<a href="' + links[i].href + '" style="display:block;padding:1rem 1.5rem;text-decoration:none;color:#0f172a;font-weight:600;font-size:1rem;border-bottom:1px solid #f1f5f9;">' + links[i].textContent + '</a>';
            }

            var cats = document.querySelectorAll('.nav-links .dropdown-content a');
            if (cats.length) {
                h += '<div style="padding:1.25rem 1.5rem 0.5rem;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.15em;font-weight:800;color:#94a3b8;">Categories</div>';
                for (var j = 0; j < cats.length; j++) {
                    h += '<a href="' + cats[j].href + '" style="display:block;padding:0.75rem 1.5rem 0.75rem 2rem;text-decoration:none;color:#475569;font-weight:500;font-size:0.95rem;border-bottom:1px solid #f8fafc;">' + cats[j].textContent.trim() + '</a>';
                }
            }

            h += '</div>';
            d.innerHTML = h;
            document.body.appendChild(d);
            this.d = d;
        }
    };

    window.D2C_NAV = nav;
})();
