import React from 'react';
import axios from 'axios';
import { connect } from 'react-redux';

import FormPage from '../../components/FormPage.jsx';
import AnimateChange from '../../components/AnimateChange.jsx';
import Button from '../../components/Button.jsx';
import handlerLoading from '../../functions/handlerLoading';

import getHeaders from '../../functions/getHeaders';
import requestSuccess from '../../functions/requestSuccess';
import saveJWT from '../../functions/saveJWT';
import checkAuth from '../../functions/checkAuth';
import { store } from '../../redux/redux';

class Name extends FormPage {
    constructor(props) {
        super(props);
        this.state = {
            fields: {},
        };

        this.parent = React.createRef();
    }

    isAnket = true;

    stepKeys = {
        1: 'anket',
        2: 'guest',
        3: 'rest',
    };

    revStepKeys = {
        anket: 1,
        guest: 2,
        rest: 3,
    };

    fields = {
        policy: {
            type: 'checkbox',
            support: () => {
                const user = store.getState().user;
                let link = 'agreement.pdf';

                if (
                    user?.extraDataRequired &&
                    Object.keys(user.extraDataRequired).find(
                        (k) => user.extraDataRequired[k]?.type === 'photo',
                    )
                ) {
                    link = 'agreement-full.pdf';
                }

                return (
                    <>
                        Я соглашаюсь с{' '}
                        <a href="/upload/docs/sp/politics.pdf" target="_blank" rel="noreferrer">
                            политикой конфиденциальности
                        </a>{' '}
                        и{' '}
                        <a href={`/upload/docs/sp/${link}`} target="_blank" rel="noreferrer">
                            условиями обработки персональных данных
                        </a>
                    </>
                );
            },
        },
    };

    keys = {
        anket: 'EXTRA_ANKET_REQUIRED',
        guest: 'GUEST',
        rest: 'REST',
    };

    async handlerUpload(name, { target }) {
        const { type } = this.props;
        const formData = new FormData();

        formData.set('file', target.files[0]);
        formData.set('fileName', name);

        await handlerLoading.call(this, name, { error: null });

        try {
            const res = await axios.post(
                `${process.env.REACT_APP_API}/api/UploadParticipantFile`,
                formData,
                { headers: getHeaders() },
            );

            requestSuccess(res);

            const { result } = res.data;

            if (result === 'OK') {
                await checkAuth(false, this.keys[type]);

                this.initFields();
            }

            handlerLoading.call(this, null);
        } catch (err) {
            console.log(err);
            handlerLoading.call(this, null);

            try {
                const { errorText } = err.response.data;

                this.setState({ error: errorText });
            } catch (error) {
                this.setState({
                    error: 'Ошибка сервера',
                });
            }
        }
    }

    async sendAnket() {
        const { fields } = this.state;
        const { user, type, next } = this.props;
        const { extraDataRequired } = user;
        const body = {};

        // if (type !== 'rest') {
        //     const thisFields = this.allFields?.[type];

        //     if (thisFields) {
        //         let error;

        //         Object.keys(thisFields).forEach((name) => {
        //             if (!error && !fields[name] && extraDataRequired[name].type !== 'photo') {
        //                 error = `Ошибка в поле ${extraDataRequired[name].title}`;
        //             }
        //         });

        //         if (error) {
        //             this.setState({ error });

        //             return;
        //         }
        //     }

        //     next();

        //     return;
        // }

        Object.keys(extraDataRequired).forEach((key) => {
            if (extraDataRequired[key].type !== 'photo') {
                body[key] = fields[key];
            }
        });

        body.agreement = !!fields.policy;
        body.step = this.revStepKeys[type];

        await handlerLoading.call(this, true, { error: null });

        try {
            const res = await axios.post(
                `/api/SendParticipantInfo`,
                { ...body },
                { headers: getHeaders() },
            );

            requestSuccess(res);

            const { result, JWT } = res.data;

            if (result === 'OK') {
                saveJWT(JWT);

                await checkAuth();

                if (next) {
                    next();
                }
            }

            handlerLoading.call(this, null);
        } catch (err) {
            handlerLoading.call(this, null);

            try {
                const { errorText } = err.response.data;

                this.setState({ error: errorText });
            } catch (error) {
                this.setState({ error: 'Ошибка сервера' });
            }
        }
    }

    initFields() {
        const { user } = this.props;
        const { extraDataRequired } = user;
        const fields = {};
        const allFields = {};

        if (extraDataRequired) {
            Object.keys(extraDataRequired).forEach((key) => {
                const fieldData = extraDataRequired[key];

                if (fieldData) {
                    fields[key] = fieldData.value || this.state.fields?.[key];

                    const stepKey = this.stepKeys[fieldData.step];

                    if (!allFields[stepKey]) {
                        allFields[stepKey] = {};
                    }

                    allFields[stepKey][key] = JSON.parse(JSON.stringify(fieldData));
                }
            });

            if (user.status === 'PARTICIPANT') {
                fields.policy = true;
            }
        }

        this.allFields = allFields;

        this.setState({ fields });
    }

    componentDidMount() {
        const { error } = this.props;

        super.componentDidMount();

        this.setState({ error }, () => {
            this.initFields();
        });
    }

    render() {
        const { error, loadingKey } = this.state;
        const { user, type } = this.props;
        const { lastError, prizes } = user;
        const prize = prizes?.[0];
        const typeFields = this.allFields?.[type];

        return (
            <div ref={this.parent} className="form">
                {type === 'anket' && (
                    <div className="form__head">
                        <h1 className="form__headTitle">
                            Поздравляем с выигрышем приза «{prize?.title}»!
                        </h1>
                        <h1 className="form__headTitle _notBottom">
                            Для получения приза, пожалуйста, заполните все поля
                            {user?.extraDataRequired &&
                                Object.keys(user.extraDataRequired).find(
                                    (k) => user.extraDataRequired[k]?.type === 'photo',
                                ) && <>&nbsp;и приложите необходимые документы</>}
                        </h1>
                        {lastError && <div className="form__headError">{lastError}</div>}
                    </div>
                )}
                {type === 'rest' && (
                    <div className="form__head">
                        <h1 className="form__headTitle _notBottom">
                            Выберите желаемую дату поездки
                        </h1>
                    </div>
                )}
                {type === 'guest' && (
                    <div className="form__head">
                        <h1 className="form__headTitle _notBottom">
                            Пожалуйста, выберите футбольного игрока, от кого хотели бы получить
                            видео-приветствие
                        </h1>
                    </div>
                )}

                <div className="form__inner">
                    <div className="form__fields">
                        {typeFields &&
                            Object.keys(typeFields).map((key) =>
                                this.renderField({
                                    name: key,
                                    field: typeFields[key],
                                }),
                            )}
                        {this.renderField({
                            name: 'policy',
                        })}
                    </div>
                    <AnimateChange
                        className="form__error _center"
                        renderKey={error}
                        paramsParent={{
                            width: document.querySelector('.form__inner')?.offsetWidth,
                        }}
                        itemParams={['width']}
                    >
                        {error ? <div className="error">{error}</div> : null}
                    </AnimateChange>
                    <div className="form__button">
                        <Button onClick={this.sendAnket.bind(this)} loader={!!loadingKey}>
                            Отправить данные
                        </Button>
                    </div>
                </div>
            </div>
        );
    }
}

function mapStateToProps(state) {
    return {
        user: state.user,
    };
}

export default connect(mapStateToProps)(Name);
