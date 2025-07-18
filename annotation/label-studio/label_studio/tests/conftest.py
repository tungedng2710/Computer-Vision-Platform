"""This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license.
"""
import logging
import os
import re
import shutil
import tempfile
from copy import deepcopy
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

import boto3
import mock
import pytest
import requests_mock
import ujson as json
from botocore.exceptions import ClientError
from django.conf import settings
from freezegun import freeze_time
from moto import mock_s3
from organizations.models import Organization
from projects.models import Project
from tasks.models import Task
from users.models import User

from label_studio.core.utils.params import get_env

# if we haven't this package, pytest.ini::env doesn't work
try:
    import pytest_env.plugin  # noqa: F401
except ImportError:
    print('\n\n !!! Please, pip install pytest-env \n\n')
    exit(-100)

from label_studio.tests.sdk.fixtures import *  # noqa: F403

from .utils import (
    azure_client_mock,
    create_business,
    gcs_client_mock,
    import_from_url_mock,
    make_project,
    ml_backend_mock,
    redis_client_mock,
    register_ml_backend_mock,
    signin,
)

boto3.set_stream_logger('botocore.credentials', logging.DEBUG)


@pytest.fixture(autouse=True)
def set_test_password_hasher(settings):
    """
    Set the password hasher to less expensive MD5 for testing purposes.
    """
    settings.PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']


@pytest.fixture(autouse=False)
def enable_csrf(settings):
    settings.USE_ENFORCE_CSRF_CHECKS = True


@pytest.fixture(autouse=False)
def label_stream_history_limit(settings):
    settings.LABEL_STREAM_HISTORY_LIMIT = 1


@pytest.fixture(autouse=True)
def disable_sentry(settings):
    settings.SENTRY_RATE = 0
    settings.SENTRY_DSN = None


@pytest.fixture()
def debug_modal_exceptions_false(settings):
    settings.DEBUG_MODAL_EXCEPTIONS = False


@pytest.fixture(scope='function')
def enable_sentry():
    settings.SENTRY_RATE = 0
    # it's disabled key, but this is correct
    settings.SENTRY_DSN = 'https://44f7a50de5ab425ca6bc406ef69b2122@o227124.ingest.sentry.io/5820521'


@pytest.fixture(scope='function')
def aws_credentials():
    """Mocked AWS Credentials for moto."""
    os.environ['AWS_ACCESS_KEY_ID'] = 'testing'
    os.environ['AWS_SECRET_ACCESS_KEY'] = 'testing'
    os.environ['AWS_SECURITY_TOKEN'] = 'testing'
    os.environ['AWS_SESSION_TOKEN'] = 'testing'


@pytest.fixture(autouse=True, scope='session')
def azure_credentials():
    """Mocked Azure credentials"""
    os.environ['AZURE_BLOB_ACCOUNT_NAME'] = 'testing'
    os.environ['AZURE_BLOB_ACCOUNT_KEY'] = 'testing'


@pytest.fixture(scope='function')
def s3(aws_credentials):
    with mock_s3():
        yield boto3.client('s3', region_name='us-east-1')


@pytest.fixture(autouse=True)
def s3_with_images(s3):
    """
    Bucket structure:
    s3://pytest-s3-images/image1.jpg
    s3://pytest-s3-images/subdir/image1.jpg
    s3://pytest-s3-images/subdir/image2.jpg
    """
    bucket_name = 'pytest-s3-images'
    s3.create_bucket(Bucket=bucket_name)
    s3.put_object(Bucket=bucket_name, Key='image1.jpg', Body='123')
    s3.put_object(Bucket=bucket_name, Key='subdir/image1.jpg', Body='456')
    s3.put_object(Bucket=bucket_name, Key='subdir/image2.jpg', Body='789')
    s3.put_object(Bucket=bucket_name, Key='subdir/another/image2.jpg', Body='0ab')
    yield s3


def s3_remove_bucket():
    """
    Remove pytest-s3-images
    """
    bucket_name = 'pytest-s3-images'
    _s3 = boto3.client('s3', region_name='us-east-1')
    _s3.delete_object(Bucket=bucket_name, Key='image1.jpg')
    _s3.delete_object(Bucket=bucket_name, Key='subdir/image1.jpg')
    _s3.delete_object(Bucket=bucket_name, Key='subdir/image2.jpg')
    _s3.delete_object(Bucket=bucket_name, Key='subdir/another/image2.jpg')
    _s3.delete_bucket(Bucket=bucket_name)
    return ''


@pytest.fixture(autouse=True)
def s3_with_jsons(s3):
    bucket_name = 'pytest-s3-jsons'
    s3.create_bucket(Bucket=bucket_name)
    s3.put_object(Bucket=bucket_name, Key='test.json', Body=json.dumps({'image_url': 'http://ggg.com/image.jpg'}))
    yield s3


@pytest.fixture(autouse=True)
def s3_with_hypertext_s3_links(s3):
    bucket_name = 'pytest-s3-jsons-hypertext'
    s3.create_bucket(Bucket=bucket_name)
    s3.put_object(
        Bucket=bucket_name,
        Key='test.json',
        Body=json.dumps(
            {'text': '<a href="s3://pytest-s3-jsons-hypertext/file with /spaces and\' / \' / quotes.jpg"/>'}
        ),
    )
    yield s3


@pytest.fixture(autouse=True)
def s3_with_partially_encoded_s3_links(s3):
    bucket_name = 'pytest-s3-json-partially-encoded'
    s3.create_bucket(Bucket=bucket_name)
    s3.put_object(
        Bucket=bucket_name,
        Key='test.json',
        Body=json.dumps(
            {
                'text': '<a href="s3://pytest-s3-json-partially-encoded/file with /spaces and\' / \' / %2Bquotes%3D.jpg"/>'
            }
        ),
    )
    yield s3


@pytest.fixture(autouse=True)
def s3_with_unexisted_links(s3):
    bucket_name = 'pytest-s3-jsons-unexisted_links'
    s3.create_bucket(Bucket=bucket_name)
    s3.put_object(Bucket=bucket_name, Key='some-existed-image.jpg', Body='qwerty')
    yield s3


@pytest.fixture(autouse=True)
def s3_export_bucket(s3):
    bucket_name = 'pytest-export-s3-bucket'
    s3.create_bucket(Bucket=bucket_name)
    yield s3


@pytest.fixture(autouse=True)
def s3_export_bucket_sse(s3):
    bucket_name = 'pytest-export-s3-bucket-with-sse'
    s3.create_bucket(Bucket=bucket_name)

    # Set the bucket policy
    policy = {
        'Version': '2012-10-17',
        'Statement': [
            {
                'Effect': 'Deny',
                'Principal': '*',
                'Action': 's3:PutObject',
                'Resource': [f'arn:aws:s3:::{bucket_name}', f'arn:aws:s3:::{bucket_name}/*'],
                'Condition': {'StringNotEquals': {'s3:x-amz-server-side-encryption': 'AES256'}},
            },
            {
                'Effect': 'Deny',
                'Principal': '*',
                'Action': 's3:PutObject',
                'Resource': [f'arn:aws:s3:::{bucket_name}', f'arn:aws:s3:::{bucket_name}/*'],
                'Condition': {'Null': {'s3:x-amz-server-side-encryption': 'true'}},
            },
            {
                'Effect': 'Deny',
                'Principal': '*',
                'Action': 's3:*',
                'Resource': [f'arn:aws:s3:::{bucket_name}', f'arn:aws:s3:::{bucket_name}/*'],
                'Condition': {'Bool': {'aws:SecureTransport': 'false'}},
            },
        ],
    }

    s3.put_bucket_policy(Bucket=bucket_name, Policy=json.dumps(policy))

    yield s3


@pytest.fixture(autouse=True)
def s3_export_bucket_kms(s3):
    bucket_name = 'pytest-export-s3-bucket-with-kms'
    s3.create_bucket(Bucket=bucket_name)

    # Set the bucket policy
    policy = {
        'Version': '2012-10-17',
        'Statement': [
            {
                'Effect': 'Deny',
                'Principal': '*',
                'Action': 's3:PutObject',
                'Resource': [f'arn:aws:s3:::{bucket_name}', f'arn:aws:s3:::{bucket_name}/*'],
                'Condition': {'StringNotEquals': {'s3:x-amz-server-side-encryption': 'aws:kms'}},
            },
            {
                'Effect': 'Deny',
                'Principal': '*',
                'Action': 's3:PutObject',
                'Resource': [f'arn:aws:s3:::{bucket_name}', f'arn:aws:s3:::{bucket_name}/*'],
                'Condition': {'Null': {'s3:x-amz-server-side-encryption': 'true'}},
            },
            {
                'Effect': 'Deny',
                'Principal': '*',
                'Action': 's3:*',
                'Resource': [f'arn:aws:s3:::{bucket_name}', f'arn:aws:s3:::{bucket_name}/*'],
                'Condition': {'Bool': {'aws:SecureTransport': 'false'}},
            },
        ],
    }

    s3.put_bucket_policy(Bucket=bucket_name, Policy=json.dumps(policy))

    yield s3


def mock_put(*args, **kwargs):
    client_error = ClientError(
        error_response={'Error': {'Code': 'AccessDenied', 'Message': 'Access Denied'}}, operation_name='PutObject'
    )
    if kwargs['ServerSideEncryption'] == 'AES256':
        if 'ServerSideEncryption' not in kwargs:
            raise client_error
    elif kwargs['ServerSideEncryption'] == 'aws:kms':
        if 'ServerSideEncryption' not in kwargs or 'SSEKMSKeyId' not in kwargs:
            raise client_error

    else:
        raise client_error


@pytest.fixture()
def mock_s3_resource_aes(mocker):
    mock_object = MagicMock()
    mock_object.put = mock_put

    mock_object_constructor = MagicMock()
    mock_object_constructor.return_value = mock_object

    mock_s3_resource = MagicMock()
    mock_s3_resource.Object = mock_object_constructor

    # Patch boto3.Session.resource to return the mock s3 resource
    mocker.patch('boto3.Session.resource', return_value=mock_s3_resource)


@pytest.fixture()
def mock_s3_resource_kms(mocker):
    mock_object = MagicMock()
    mock_object.put = mock_put

    mock_object_constructor = MagicMock()
    mock_object_constructor.return_value = mock_object

    mock_s3_resource = MagicMock()
    mock_s3_resource.Object = mock_object_constructor

    # Patch boto3.Session.resource to return the mock s3 resource
    mocker.patch('boto3.Session.resource', return_value=mock_s3_resource)


@pytest.fixture(autouse=True)
def gcs_client():
    with gcs_client_mock():
        yield


@pytest.fixture(autouse=True)
def azure_client():
    with azure_client_mock():
        yield


@pytest.fixture(autouse=True)
def redis_client():
    with redis_client_mock():
        yield


@pytest.fixture
def ml_backend_for_test_predict(ml_backend):
    # ML backend with single prediction per task
    register_ml_backend_mock(
        ml_backend,
        url='http://test.ml.backend.for.sdk.com:9092',
        predictions={
            'results': [
                {
                    'model_version': 'ModelSingle',
                    'score': 0.1,
                    'result': [
                        {'from_name': 'label', 'to_name': 'text', 'type': 'choices', 'value': {'choices': ['Single']}}
                    ],
                },
            ]
        },
    )
    # ML backend with multiple predictions per task
    register_ml_backend_mock(
        ml_backend,
        url='http://test.ml.backend.for.sdk.com:9093',
        predictions={
            'results': [
                [
                    {
                        'model_version': 'ModelA',
                        'score': 0.2,
                        'result': [
                            {
                                'from_name': 'label',
                                'to_name': 'text',
                                'type': 'choices',
                                'value': {'choices': ['label_A']},
                            }
                        ],
                    },
                    {
                        'model_version': 'ModelB',
                        'score': 0.3,
                        'result': [
                            {
                                'from_name': 'label',
                                'to_name': 'text',
                                'type': 'choices',
                                'value': {'choices': ['label_B']},
                            }
                        ],
                    },
                ]
            ]
        },
    )
    yield ml_backend


@pytest.fixture(autouse=True)
def ml_backend():
    with ml_backend_mock() as m:
        yield m


@pytest.fixture(name='import_from_url')
def import_from_url():
    with import_from_url_mock() as m:
        yield m


@pytest.fixture(autouse=True)
def ml_backend_1(ml_backend):
    register_ml_backend_mock(
        ml_backend, url='https://test.heartex.mlbackend.com:9090', setup_model_version='Fri Feb 19 17:10:44 2021'
    )
    register_ml_backend_mock(ml_backend, url='https://test.heartex.mlbackend.com:9091', health_connect_timeout=True)
    register_ml_backend_mock(ml_backend, url='http://localhost:8999', predictions={'results': []})
    yield ml_backend


def pytest_configure():
    for q in settings.RQ_QUEUES.values():
        q['ASYNC'] = False


class URLS:
    """This class keeps urls with api"""

    def __init__(self):
        self.project_create = '/api/projects/'
        self.task_bulk = None

    def set_project(self, pk):
        self.task_bulk = f'/api/projects/{pk}/tasks/bulk/'
        self.plots = f'/projects/{pk}/plots'


def project_ranker():
    label = """<View>
         <HyperText name="hypertext_markup" value="$markup"></HyperText>
         <List name="ranker" value="$replies" elementValue="$text" elementTag="Text"
               ranked="true" sortedHighlightColor="#fcfff5"></List>
        </View>"""
    return {'label_config': label, 'title': 'test'}


def project_dialog():
    """Simple project with dialog configs

    :return: config of project with task
    """
    label = """<View>
      <TextEditor>
        <Text name="dialog" value="$dialog"></Text>
        <Header value="Your answer is:"></Header>
        <TextArea name="answer"></TextArea>
      </TextEditor>
    </View>"""

    return {'label_config': label, 'title': 'test'}


def project_choices():
    label = """<View>
    <Choices name="animals" toName="xxx" choice="single-radio">
      <Choice value="Cat"></Choice>
      <Choice value="Dog"></Choice>
      <Choice value="Opossum"></Choice>
      <Choice value="Mouse"></Choice>
      <Choice value="Human"/>
    </Choices>

    <Choices name="things" toName="xxx" choice="single-radio">
      <Choice value="Chair"></Choice>
      <Choice value="Car"></Choice>
      <Choice value="Lamp"></Choice>
      <Choice value="Guitar"></Choice>
      <Choice value="None"/>
    </Choices>

    <Image name="xxx" value="$image"></Image>
    </View>"""
    return {'label_config': label, 'title': 'test'}


def setup_project(client, project_template, do_auth=True, legacy_api_tokens_enabled=False):
    """Create new test@gmail.com user, login via client, create test project.
    Project configs are thrown over params and automatically grabs from functions names started with 'project_'

    :param client: fixture with http client (from pytest-django package) and simulation of http server
    :param project_template: dict with project config
    :param do_auth: make authorization for creating user
    """
    client = deepcopy(client)
    email = 'test@gmail.com'
    password = 'test'
    urls = URLS()
    project_config = project_template()

    # we work in empty database, so let's create business user and login
    user = User.objects.create(email=email)
    user.set_password(password)  # set password without hash

    create_business(user)
    org = Organization.create_organization(created_by=user, title=user.first_name)
    if legacy_api_tokens_enabled:
        org.jwt.legacy_api_tokens_enabled = True
        org.jwt.save()
    user.active_organization = org
    user.save()

    if do_auth:

        assert signin(client, email, password).status_code == 302
        # create project
        with requests_mock.Mocker() as m:
            m.register_uri('POST', re.compile(r'ml\.heartex\.net/\d+/validate'), text=json.dumps({'status': 'ok'}))
            m.register_uri('GET', re.compile(r'ml\.heartex\.net/\d+/health'), text=json.dumps({'status': 'UP'}))
            r = client.post(urls.project_create, data=project_config)
            print('Project create with status code:', r.status_code)
            assert r.status_code == 201, 'Create project result should be redirect to the next page'

        # get project id and prepare url
        project = Project.objects.filter(title=project_config['title']).first()
        urls.set_project(project.pk)
        print('Project id:', project.id)

        client.project = project

    client.user = user
    client.urls = urls
    client.project_config = project_config
    client.org = org
    return client


@pytest.fixture
def setup_project_dialog(client):
    return setup_project(client, project_dialog)


@pytest.fixture
def setup_project_for_token(client):
    return setup_project(client, project_dialog, do_auth=False, legacy_api_tokens_enabled=True)


@pytest.fixture
def setup_project_ranker(client):
    return setup_project(client, project_ranker)


@pytest.fixture
def setup_project_choices(client):
    return setup_project(client, project_choices)


@pytest.fixture()
def contextlog_test_config(settings):
    """
    Configure settings for contextlog tests in CI.
    Be sure that responses is activated in any testcase where this fixture is used.
    """

    settings.COLLECT_ANALYTICS = True
    settings.CONTEXTLOG_SYNC = True
    settings.TEST_ENVIRONMENT = False
    settings.DEBUG_CONTEXTLOG = False


@pytest.fixture
def business_client(client):
    # we work in empty database, so let's create business user and login
    client = deepcopy(client)
    email = 'business@pytest.net'
    password = 'pytest'
    user = User.objects.create(email=email)
    user.set_password(password)  # set password without hash
    business = create_business(user)

    user.save()
    org = Organization.create_organization(created_by=user, title=user.first_name)
    org.jwt.legacy_api_tokens_enabled = True
    org.jwt.save()
    client.business = business if business else SimpleNamespace(admin=user)
    client.team = None if business else SimpleNamespace(id=1)
    client.admin = user
    client.annotator = user
    client.user = user
    client.api_key = user.reset_token().key
    client.organization = org

    if signin(client, email, password).status_code != 302:
        print(f'User {user} failed to login!')
    return client


@pytest.fixture
def annotator_client(client):
    # we work in empty database, so let's create business user and login
    client = deepcopy(client)
    email = 'annotator@pytest.net'
    password = 'pytest'
    user = User.objects.create(email=email)
    user.set_password(password)  # set password without hash
    user.save()
    create_business(user)
    Organization.create_organization(created_by=user, title=user.first_name)
    if signin(client, email, password).status_code != 302:
        print(f'User {user} failed to login!')
    client.user = user
    client.annotator = user
    return client


@pytest.fixture
def annotator2_client(client):
    # we work in empty database, so let's create business user and login
    client = deepcopy(client)
    email = 'annotator2@pytest.net'
    password = 'pytest'
    user = User.objects.create(email=email)
    user.set_password(password)  # set password without hash
    user.save()
    create_business(user)
    Organization.create_organization(created_by=user, title=user.first_name)
    if signin(client, email, password).status_code != 302:
        print(f'User {user} failed to login!')
    client.user = user
    client.annotator = user
    return client


@pytest.fixture(params=['business', 'annotator'])
def any_client(request, business_client, annotator_client):
    if request.param == 'business':
        return business_client
    elif request.param == 'annotator':
        return annotator_client


@pytest.fixture
def configured_project(business_client, annotator_client):
    _project_for_text_choices_onto_A_B_classes = dict(
        title='Test',
        label_config="""
            <View>
              <Text name="meta_info" value="$meta_info"></Text>
              <Text name="text" value="$text"></Text>
              <Choices name="text_class" toName="text" choice="single">
                <Choice value="class_A"></Choice>
                <Choice value="class_B"></Choice>
              </Choices>
            </View>""",
    )
    _2_tasks_with_textA_and_textB = [
        {'meta_info': 'meta info A', 'text': 'text A'},
        {'meta_info': 'meta info B', 'text': 'text B'},
    ]

    # get user to be owner
    users = User.objects.filter(email='business@pytest.net')  # TODO(nik): how to get proper email for business here?
    project = make_project(_project_for_text_choices_onto_A_B_classes, users[0])

    assert project.ml_backends.first().url == 'http://localhost:8999'

    Task.objects.bulk_create([Task(data=task, project=project) for task in _2_tasks_with_textA_and_textB])
    return project


@pytest.fixture(name='django_live_url')
def get_server_url(live_server):
    yield live_server.url


@pytest.fixture(name='ff_front_dev_1682_model_version_dropdown_070622_short_off', autouse=True)
def ff_front_dev_1682_model_version_dropdown_070622_short_off():
    from core.feature_flags import flag_set

    def fake_flag_set(*args, **kwargs):
        if args[0] == 'ff_front_dev_1682_model_version_dropdown_070622_short':
            return False
        return flag_set(*args, **kwargs)

    with mock.patch('tasks.serializers.flag_set', wraps=fake_flag_set):
        yield


@pytest.fixture(name='async_import_off', autouse=True)
def async_import_off():
    from core.feature_flags import flag_set

    def fake_flag_set(*args, **kwargs):
        return flag_set(*args, **kwargs)

    with mock.patch('data_import.api.flag_set', wraps=fake_flag_set):
        yield


@pytest.fixture(autouse=True, scope='session')
def set_feature_flag_envvar():
    """
    Automatically set the environment variable for all tests, including Tavern tests.
    """
    os.environ['fflag_optic_all_optic_1938_storage_proxy'] = 'true'


@pytest.fixture(name='fflag_feat_back_lsdv_3958_server_side_encryption_for_target_storage_short_on')
def fflag_feat_back_lsdv_3958_server_side_encryption_for_target_storage_short_on():
    from core.feature_flags import flag_set

    def fake_flag_set(*args, **kwargs):
        if args[0] == 'fflag_feat_back_lsdv_3958_server_side_encryption_for_target_storage_short':
            return True
        return flag_set(*args, **kwargs)

    with mock.patch('io_storages.s3.models.flag_set', wraps=fake_flag_set):
        yield


@pytest.fixture(name='fflag_fix_all_lsdv_4813_async_export_conversion_22032023_short_on')
def fflag_fix_all_lsdv_4813_async_export_conversion_22032023_short_on():
    from core.feature_flags import flag_set

    def fake_flag_set(*args, **kwargs):
        if args[0] == 'fflag_fix_all_lsdv_4813_async_export_conversion_22032023_short':
            return True
        return flag_set(*args, **kwargs)

    with mock.patch('data_export.api.flag_set', wraps=fake_flag_set):
        yield


@pytest.fixture(name='ff_back_dev_4664_remove_storage_file_on_export_delete_29032023_short_on')
def ff_back_dev_4664_remove_storage_file_on_export_delete_29032023_short_on():
    from core.feature_flags import flag_set

    def fake_flag_set(*args, **kwargs):
        if args[0] == 'ff_back_dev_4664_remove_storage_file_on_export_delete_29032023_short':
            return True
        return flag_set(*args, **kwargs)

    with mock.patch('data_export.api.flag_set', wraps=fake_flag_set):
        yield


@pytest.fixture(name='fflag_feat_utc_46_session_timeout_policy_off')
def fflag_feat_utc_46_session_timeout_policy_off():
    from core.feature_flags import flag_set

    def fake_flag_set(*args, **kwargs):
        if args[0] == 'fflag_feat_utc_46_session_timeout_policy':
            return False
        return flag_set(*args, **kwargs)

    with mock.patch('core.middleware.flag_set', wraps=fake_flag_set):
        yield


@pytest.fixture(name='fflag_feat_utc_46_session_timeout_policy_on')
def fflag_feat_utc_46_session_timeout_policy_on():
    from core.feature_flags import flag_set

    def fake_flag_set(*args, **kwargs):
        if args[0] == 'fflag_feat_utc_46_session_timeout_policy':
            return True
        return flag_set(*args, **kwargs)

    with mock.patch('core.middleware.flag_set', wraps=fake_flag_set):
        yield


@pytest.fixture(name='local_files_storage')
def local_files_storage(settings):
    settings.LOCAL_FILES_SERVING_ENABLED = True
    tempdir = Path(tempfile.gettempdir()) / Path('files')
    subdir = tempdir / Path('subdir')
    os.makedirs(str(subdir), exist_ok=True)
    test_image = Path(*'tests/test_suites/samples/test_image.png'.split('/'))
    shutil.copyfile(str(test_image), str(tempdir / Path('test_image1.png')))
    shutil.copyfile(str(test_image), str(subdir / Path('test_image2.png')))


@pytest.fixture(name='local_files_document_root_tempdir')
def local_files_document_root_tempdir(settings):
    tempdir = Path(tempfile.gettempdir())
    settings.LOCAL_FILES_DOCUMENT_ROOT = tempdir.root


@pytest.fixture(name='local_files_document_root_subdir')
def local_files_document_root_subdir(settings):
    tempdir = Path(tempfile.gettempdir()) / Path('files')
    settings.LOCAL_FILES_DOCUMENT_ROOT = str(tempdir)


@pytest.fixture(name='testing_session_timeouts')
def set_testing_session_timeouts(settings):
    settings.MAX_SESSION_AGE = int(get_env('MAX_SESSION_AGE', timedelta(seconds=6).total_seconds()))
    settings.MAX_TIME_BETWEEN_ACTIVITY = int(
        get_env('MAX_TIME_BETWEEN_ACTIVITY', timedelta(seconds=2).total_seconds())
    )


@pytest.fixture
def mock_ml_auto_update(name='mock_ml_auto_update'):
    url = 'http://localhost:9090'
    with requests_mock.Mocker(real_http=True) as m:
        m.register_uri(
            'POST',
            f'{url}/setup',
            [
                {'json': {'model_version': 'version1', 'status': 'ok'}, 'status_code': 200},
                {'json': {'model_version': 'version1', 'status': 'ok'}, 'status_code': 200},
                {'json': {'model_version': 'version1', 'status': 'ok'}, 'status_code': 200},
                {'json': {'model_version': 'version2', 'status': 'ok'}, 'status_code': 200},
                {'json': {'model_version': 'version3', 'status': 'ok'}, 'status_code': 200},
            ],
        )
        m.get(f'{url}/health', text=json.dumps({'status': 'UP'}))
        yield m


@pytest.fixture(name='mock_ml_backend_auto_update_disabled')
def mock_ml_backend_auto_update_disabled():
    with ml_backend_mock(setup_model_version='version1') as m:
        m.register_uri(
            'GET',
            'http://localhost:9090/setup',
            [
                {'json': {'model_version': '', 'status': 'ok'}, 'status_code': 200},
                {'json': {'model_version': '2', 'status': 'ok'}, 'status_code': 200},
            ],
        )
        yield m


freezer = None
now = None


@pytest.fixture(name='freeze_clock')
def freeze_clock():
    global freezer
    global now

    now = datetime.now()
    freezer = freeze_time(now)
    freezer.start()

    yield

    # teardown steps after yield

    freezer.stop()
    freezer = None
    now = None


def tick_clock(_, seconds: int = 1) -> None:
    global freezer
    global now
    freezer.stop()
    now += timedelta(seconds=seconds)
    freezer = freeze_time(now)
    freezer.start()


def freeze_datetime(response, utc_time: str) -> None:
    global freezer
    freezer.stop()
    freezer = freeze_time(utc_time)
    freezer.start()


def pytest_collection_modifyitems(config, items):
    # This function is called by pytest after the collection of tests has been completed to modify their order
    # it is being used as a workaround for the fact the kms and aes mocks resist teardown and cause other test failures

    mock_tests = []
    other_tests = []
    for item in items:
        if 'mock_s3_resource_kms' in item.fixturenames or 'mock_s3_resource_aes' in item.fixturenames:
            mock_tests.append(item)
        else:
            other_tests.append(item)

    items[:] = other_tests + mock_tests
