module.exports = app => {

    /**
     * @TODO
     * routing config'e çekilebilir
     */

    app.all('/admin*', app.middle.basic, (req, res, next) => {
        const segment = res.locals.segments[2];
        const routes  = ['login', 'logout'];

        if( ! req.session.adminUserId && ! routes.includes(segment) )
            return res.redirect('/admin/login');

        next();
    });

    return true;

};




