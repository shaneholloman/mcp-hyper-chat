import React, { createContext, useEffect, useState } from "react";
import {
  Routes,
  Route,
  Outlet,
  Link,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { v4 } from "uuid";
import OpenAI from "openai";
import Clarity from "@microsoft/clarity";
import {
  Button,
  Table,
  Switch,
  Modal,
  message,
  Radio,
  Input,
  Tabs,
  ConfigProvider,
  Popconfirm,
  Popover,
  Dropdown,
  Space,
  MenuProps,
  Select,
  Spin,
  Progress,
  Form,
  Divider,
  Tooltip,
  InputNumber,
  Tag,
  Timeline,
  notification,
  Drawer,
} from "antd";
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";

import {
  AndroidOutlined,
  CheckOutlined,
  ChromeFilled,
  CloseOutlined,
  CloudOutlined,
  CrownFilled,
  DownOutlined,
  ExclamationCircleFilled,
  GiftOutlined,
  GithubFilled,
  InfoCircleFilled,
  LoadingOutlined,
  LogoutOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  QuestionCircleFilled,
  RocketOutlined,
  SmileFilled,
  SmileOutlined,
  SyncOutlined,
  TabletFilled,
} from "@ant-design/icons";

import { HeaderContext } from "./common/context";
import {
  PageContainer,
  ProBreadcrumb,
  ProCard,
  ProLayout,
} from "@ant-design/pro-components";
import { getLayoutRoute } from "./router";
import { currLang, setCurrLang, t } from "./i18n";
import { call, msg_receive } from "./common/call";
import {
  AppSetting,
  ChatHistory,
  DataList,
  electronData,
  GPT_MODELS,
  IMCPClient,
  KNOWLEDGE_BASE,
  MCP_CONFIG,
} from "../../common/data";
import { InitedClient, initMcpClients, setClients } from "./common/mcp";
import { EVENT } from "./common/event";
import { OpenAiChannel } from "./common/openai";
import { DndTable } from "./common/dndTable";
import { sleep } from "./common/sleep";
import { InputPlus } from "./common/input_plus";
import { rejects } from "assert";
import {
  enable as enableDarkMode,
  disable as disableDarkMode,
  auto as followSystemColorScheme,
  exportGeneratedCSS as collectCSS,
  isEnabled as isDarkReaderEnabled,
  setFetchMethod as setDarkReaderFetchMethod,
} from "darkreader";
import { Pre } from "./components/pre";
import { Icon } from "./components/icon";
import { getDefaultModelConfigSync } from "./components/ai";

setDarkReaderFetchMethod((url) => {
  return fetch(url, {
    credentials: "omit",
    mode: "no-cors",
  });
})

type ProviderType = {
  label: string;
  baseURL: string;
  apiKey?: string;
  call_tool_step?: number;
  value: string;
};

const Providers: ProviderType[] = [
  {
    label: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    value: "openai",
  },
  {
    label: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    value: "openrouter",
  },
  {
    label: "Gemini(Openai)",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    value: "gemini-openai",
  },
  process.env.myEnv == "dev" && {
    label: "Anthropic",
    baseURL: "https://api.anthropic.com",
    value: "anthropic",
  },
  {
    label: "Anthropic(Openai)",
    baseURL: "https://api.anthropic.com/v1",
    value: "anthropic-openai",
  },
  {
    label: "XAI",
    baseURL: "https://api.x.ai/v1",
    value: "xai",
  },
  {
    label: "Qwen",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    value: "qwen",
  },
  {
    label: "Ollama",
    baseURL: "http://127.0.0.1:11434/v1",
    apiKey: "ollama",
    value: "ollama",
  },
  {
    label: "DoubBao",
    baseURL: "https://ark.cn-beijing.volces.com/api/v3",
    value: "doubao",
  },
  {
    label: "GLM",
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
    value: "glm",
  },
  {
    label: "DeepSeek",
    baseURL: "https://api.deepseek.com",
    value: "deepseek",
    call_tool_step: 1,
  },
  {
    label: "OpenAI Compatibility",
    baseURL: "",
    value: "other",
  },
].filter((x) => x);

msg_receive("message-from-main", (msg) => {
  if (msg.type == "TaskResult") {
    // setTimeout(() => {
    //   ChatHistory.init({ force: true });
    // }, 300);
    notification.open({
      message: (
        <div>
          <span className="text-red-400">{msg.data.task.name}</span> Task Done
          by agent: <Tag color="blue">{msg.data.agent.label}</Tag>
        </div>
      ),
      description: msg.data.result,
      onClick: () => {
        // console.log("Notification Clicked!");
        try {
          window["w"]["navigate"](`/Task/Results?taskKey=${msg.data.task.key}`);
        } catch (e) { }
      },
      duration: 10 * 1000,
    });
  }
});

export function Layout() {
  const [num, setNum] = useState(0);
  function refresh() {
    setNum((n) => n + 1);
  }
  const navigate = useNavigate();
  const location = useLocation();
  // console.log(location.pathname); // 输出当前路径
  window["w"] = {};
  window["w"]["navigate"] = navigate;
  window["w"]["location"] = location;

  useEffect(() => {
    setTimeout(() => {
      if (location.pathname == "/") {
        navigate("/Chat");
      }
    });
    // EVENT.on("setIsToolsShowTrue", () => {
    //   setIsToolsShow(true);
    // });
    EVENT.on("setIsModelConfigOpenTrue", () => {
      setIsModelConfigOpen(true);
    });
  }, []);
  useEffect(() => {
    msg_receive("message-from-main", async (res: any) => {
      // console.log("UpdateMsg! ", res);

      if (res.type == "UpdateMsg" && res.data.status == 1) {
        setUpdateData(res.data);
      }

      if (res.type == "UpdateMsg" && res.data.status == 4) {
        Modal.confirm({
          title: "Update",
          content:
            "The new version has been downloaded, do you want to restart and update?",
          icon: <ExclamationCircleFilled />,
          okText: "Restart And Update",
          onOk() {
            call("quitAndInstall", []);
          },
        });
      }

      if (res.type == "sync") {
        setSyncStatus(res.data.status);
        if (res.data.status == 0) {
          // for (let data of DataList) {
          //   if (data.options.sync) {
          //     await data.init();
          //   }
          // }
          setTimeout(() => {
            refresh();
          }, 500);
          refresh();
        }
      }
      if (res.type === "changeMcpClient") {
        setMcpClients(res.data);
        setClients(res.data);
        window.getTools = (allowMCPs) => {
          let tools: IMCPClient["tools"] = [];

          res.data.forEach((v) => {
            tools = tools.concat(
              v.tools.filter((t) => {
                if (!allowMCPs) return true;
                return (
                  allowMCPs.includes(t.clientName) || allowMCPs.includes(t.restore_name)
                );
              }),
            );
          });
          return tools;
        }
      }
    });
  }, []);
  useEffect(() => {
    (async () => {
      await Promise.all([
        GPT_MODELS.init(),
        MCP_CONFIG.init(),
        KNOWLEDGE_BASE.init(),
        electronData.init(),
      ]);
      refresh();

      let res = await call("checkUpdate", []);
      if (res) {
        console.log("checkUpdate: ", res);
      }
      await initMcpClients();
      refresh();
      Clarity.init("p731bym3zs");
      Clarity.consent();
      Clarity.event("openApp");
      Clarity.setTag("env", process.env.NODE_ENV);
      Clarity.event(
        `openApp-${process.env.NODE_ENV}-${electronData.get().version}`,
      );
      Clarity.setTag("version", electronData.get().version);

    })();
  }, []);

  const [locale, setLocal] = useState(currLang == "zhCN" ? zhCN : enUS);
  const [collapsed, setCollapsed] = useState(false);
  const [isModelConfigOpen, setIsModelConfigOpen] = useState(false);
  const [isAddModelConfigOpen, setIsAddModelConfigOpen] = useState(false);
  // const [currRow, setCurrRow] = useState({} as any);
  const [form] = Form.useForm();

  const [mcpClients, setMcpClients] = useState<InitedClient[]>([]);

  const [loadingCheckLLM, setLoadingCheckLLM] = useState(false);
  const [syncStatus, setSyncStatus] = useState(0);

  const [updateData, setUpdateData] = useState({} as any);


  const [timelineData, setTimelineData] = useState([]);
  const [isOpenTestLLM, setIsOpenTestLLM] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    (async () => {
      await AppSetting.init();
      refresh();
    })();
  }, []);

  const [modelOptions, setModelOptions] = useState([]);

  const setLang = (e) => {
    setCurrLang(e);
    setLocal(e == "zhCN" ? zhCN : enUS);
    refresh();
  };
  let defaultModel = getDefaultModelConfigSync(GPT_MODELS);

  return (
    <ConfigProvider locale={locale}>
      <div style={{ width: "100%", margin: "0px auto" }}>
        <ProLayout
          prefixCls="my-prefix"
          collapsed={collapsed}
          onCollapse={(collapsed) => {
            setCollapsed(collapsed);
          }}
          route={getLayoutRoute()}
          location={{
            pathname: location.pathname,
          }}
          token={{
            header: {
              colorBgMenuItemSelected: "rgba(0,0,0,0.04)",
            },
          }}
          siderMenuType="group"
          menu={{
            collapsedShowGroupTitle: true,
          }}
          actionsRender={(props) => {
            return (
              <Space>
                <a href="https://github.com/BigSweetPotatoStudio/HyperChat">
                  <GithubFilled></GithubFilled>
                </a>
                <Button
                  onClick={() => {
                    setIsModelConfigOpen(true);
                    if (GPT_MODELS.get().data.length == 0) {
                      form.resetFields();
                      setIsAddModelConfigOpen(true);
                    }
                  }}
                  icon={<Icon name="brain" />}
                >
                  LLM
                </Button>
                <Select
                  className="hidden lg:inline-block"
                  value={currLang}
                  style={{ width: 120 }}
                  onChange={(e) => {
                    // setCurrLang(e);
                    // setLocal(e == "zhCN" ? zhCN : enUS);
                    // refresh();
                    setLang(e);
                  }}
                  options={[
                    { value: "zhCN", label: "中文" },
                    { value: "enUS", label: "English" },
                  ]}
                />

                <Switch
                  checkedChildren={"🌙"}
                  unCheckedChildren={"☀️"}
                  checked={AppSetting.get().darkTheme}
                  onChange={async (checked) => {
                    AppSetting.get().darkTheme = checked;
                    await AppSetting.save();
                    refresh();
                    if (checked) {
                      enableDarkMode({
                        brightness: 100,
                        contrast: 90,
                        sepia: 10,
                      });
                    } else {
                      disableDarkMode();
                    }
                  }}
                />
              </Space>
            );
          }}
          avatarProps={{
            // src: user.icon,
            // size: "small",
            // title: (user.name || "用户") + `(${user.email || "去登录"})`,
            render: (props, dom) => {
              return (
                <>
                  {/* <Button>
                 
                    任务
                  </Button> */}

                  <Button
                    type="link"
                    style={{
                      color:
                        syncStatus == 1
                          ? undefined
                          : syncStatus == -1
                            ? "red"
                            : "gray",
                    }}
                    onClick={() => {
                      navigate("./Setting/WebdavSetting");
                    }}
                  >
                    <SyncOutlined spin={syncStatus == 1} />

                    {syncStatus == 1
                      ? "Syncing"
                      : syncStatus == -1
                        ? "Failed"
                        : "Sync"}
                  </Button>
                </>
              );
            },
          }}
          logo={
            <img
              onClick={() => {
                window.location.hash = "#/Home";
              }}
              src="./assets/favicon.png"
            ></img>
          }
          headerTitleRender={(logo, title, _) => {
            return (
              <Link to="Home">
                HyperChat<span>({electronData.get().version}){updateData.info && <Tag className=" text-red-600" onClick={() => {
                  Modal.confirm({
                    title: t`A new version is available`,
                    width: "80%",
                    style: {
                      maxWidth: 1024,
                    },
                    content: (
                      <div>
                        <div>current version: {electronData.get().version}</div>
                        <div>latest version: {updateData.info.version}</div>
                        {updateData.info.releaseName != updateData.info.version && (
                          <div>title: {updateData.info.releaseName}</div>
                        )}
                        <div>
                          changelog:{" "}
                          {typeof updateData.info.releaseNotes == "string" ? (
                            <div
                              style={{ color: "gray" }}
                              dangerouslySetInnerHTML={{
                                __html: updateData.info.releaseNotes,
                              }}
                            ></div>
                          ) : (
                            updateData.info.releaseNotes.map((x) => {
                              return (
                                <div dangerouslySetInnerHTML={{ __html: x.note }}></div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    ),
                    okText: t`Download And Update`,
                    onOk: async () => {
                      call("checkUpdateDownload", []);
                    },
                  });
                }}>{`New`}</Tag>}</span>
              </Link>
            );
          }}
          menuFooterRender={(props) => {
            if (props?.collapsed) return undefined;
            return (
              <div
                style={{
                  textAlign: "center",
                  paddingBlockStart: 12,
                }}
              >
                Welcome to use
              </div>
            );
          }}
          // breadcrumbRender={(routers = []) => {
          //   // console.log(routers);
          //   return [
          //     // { path: "/", breadcrumbName: "主页" },
          //     ...routers,
          //   ];
          // }}
          // onMenuHeaderClick={(e) => console.log(e)}
          menuItemRender={(item, dom) => <Link to={item.path}>{dom}</Link>}
          layout="mix"
          splitMenus={true}
        >
          <HeaderContext.Provider
            value={{
              globalState: num, updateGlobalState: refresh, setLang,
              mcpClients,

            }}
          >
            <Outlet />
          </HeaderContext.Provider>
        </ProLayout>

        <Drawer
          width={1000}
          title={t`My LLM Models`}
          open={isModelConfigOpen}
          // cancelButtonProps={{ style: { display: "none" } }}
          onClose={() => {
            setIsModelConfigOpen(false);
          }}
          styles={{
            body: {
              padding: 0,
            }
          }}
        >
          <DndTable

            footer={() => (
              <div className="text-center">
                <Button
                  type="link"
                  onClick={() => {
                    form.resetFields();

                    setModelOptions([]);
                    setIsAddModelConfigOpen(true);
                  }}
                >
                  {t`Add`}
                </Button>
                <Button
                  type="link"
                  onClick={async () => {
                    let p = await call("pathJoin", ["gpt_models.json"]);
                    await call("openExplorer", [p]);
                  }}
                >
                  {t`Open the configuration file`}
                </Button>
              </div>
            )}
            size="small"
            scroll={{ y: "calc(-151px + 100vh)" }}
            pagination={false}
            dataSource={GPT_MODELS.get().data}
            onMove={(data) => {
              GPT_MODELS.get().data = data;
              GPT_MODELS.save();
              refresh();
            }}
            columns={[
              {
                title: t`name`,
                dataIndex: "name",
                key: "name",
                width: 200,
                render: (text, record, index) => {
                  return (
                    <div>
                      <div>{text}</div>
                      {record.type && <Tag color="red">{record.type}</Tag>}
                      {record.supportImage && <Tag color="blue">image</Tag>}
                      {record.supportTool && <Tag color="blue">tool</Tag>}
                      {record.key == defaultModel.key && <Tag color="green">{t`default`}</Tag>}
                    </div>
                  );
                },
              },
              {
                title: t`LLM`,
                dataIndex: "model",
                key: "model",
                width: 200,
              },
              {
                title: t`Provider`,
                dataIndex: "provider",
                key: "provider",
                width: 200,
                filters: Providers.map((x) => {
                  return {
                    text: x.label,
                    value: x.value,
                  };
                }),
                onFilter: (value, record) => record.provider.startsWith(value as string),
                filterSearch: true,
                render: (text, record, index) => {
                  let find = Providers.find((x) => x.value == text);
                  if (find == null) {
                    return text;
                  }
                  return find.label;
                }
              },

              {
                title: t`Operation`,
                dataIndex: "key",
                key: "key",
                width: 300,
                render: (text, record, index) => (
                  <div className="flex flex-wrap gap-2">
                    <a
                      type="link"
                      onClick={async () => {
                        form.resetFields();
                        if (record.provider == null) {
                          record.provider = "other";
                        }

                        setModelOptions([]);
                        form.setFieldsValue(record);
                        setIsAddModelConfigOpen(true);
                      }}
                    >
                      {t`Edit`}
                    </a>

                    <a
                      type="link"
                      onClick={async () => {
                        let clone = { ...record };
                        clone.key = v4();
                        GPT_MODELS.get().data.splice(index + 1, 0, clone);

                        await GPT_MODELS.save();
                        refresh();
                      }}
                    >
                      {t`Clone`}
                    </a>

                    <Popconfirm
                      title="Confirm"
                      description="Confirm Delete?"
                      onConfirm={async () => {
                        GPT_MODELS.get().data = GPT_MODELS.get().data.filter(
                          (e) => e.key != record.key,
                        );
                        await GPT_MODELS.save();
                        refresh();
                      }}
                    >
                      <a type="link">{t`Delete`}</a>
                    </Popconfirm>

                    <Tooltip title={t`Set default`}>
                      <a
                        type="link"
                        onClick={async () => {
                          GPT_MODELS.get().data.forEach((m) => {
                            m.isDefault = false;
                          });
                          record.isDefault = true;
                          await GPT_MODELS.save();
                          refresh();
                        }}
                      >
                        {t`Default`}
                      </a>
                    </Tooltip>
                  </div>
                ),
              },
            ]}
          />
        </Drawer >
        <Modal
          width={600}
          title={t`Configure LLM`}
          open={isAddModelConfigOpen}
          maskClosable={false}
          // okButtonProps={{
          //   autoFocus: true,
          //   htmlType: "submit",
          //   loading: loadingCheckLLM,
          // }}
          // cancelButtonProps={{ style: { display: "none" } }}
          onCancel={() => {
            setIsAddModelConfigOpen(false);
          }}
          footer={[
            form.getFieldValue("key") && <Button key="save" onClick={() => {
              form.validateFields().then(async (values) => {
                if (values.key) {
                  let index = GPT_MODELS.get().data.findIndex(
                    (e) => e.key == values.key,
                  );
                  if (index == -1) {
                    return;
                  }
                  values.name = values.name || values.model;
                  GPT_MODELS.get().data[index] = values;
                  await GPT_MODELS.save();
                } else {
                  values.name = values.name || values.model;
                  values.key = v4();
                  GPT_MODELS.get().data.push(values);
                  await GPT_MODELS.save();
                }
                refresh();
                setIsAddModelConfigOpen(false);
              }).catch(() => { })
            }}>
              {t`Save`}
            </Button>,
            <Button key="submit" type="primary" htmlType="submit">
              {t`Submit`}
            </Button>
          ].filter(x => x)}
          modalRender={(dom) => (
            <Form
              form={form}
              layout="horizontal"
              name="AddModelConfig"
              initialValues={{
                provider: Providers[0].value,
                baseURL: Providers[0].baseURL,
                type: "llm",
              }}
              clearOnDestroy
              onFinish={async (values) => {
                try {
                  setLoadingCheckLLM(true);
                  // message.info("Testing the configuration, please wait...");
                  let save = true;
                  if (values.type == "embedding") {
                    let list = KNOWLEDGE_BASE.get().dbList.filter(
                      (x) => x.model == values.key,
                    );
                    if (list.length > 0) {
                      await new Promise((resolve, reject) => {
                        Modal.confirm({
                          title: t`Warning`,
                          content: (
                            <pre
                              style={{
                                whiteSpace: "pre-wrap",
                                wordWrap: "break-word",
                              }}
                            >
                              {t`The model is already in knowledge_base use, do you want to continue?` +
                                "\n"}
                              {list.map((x) => (
                                <div>
                                  <Tag>{x.name}</Tag>
                                </div>
                              ))}
                            </pre>
                          ),
                          onOk: () => {
                            resolve(1);
                          },
                          onCancel: () => {
                            reject(0);
                          },
                        });
                      });
                    }
                  } else {
                    setPending(true);
                    setIsOpenTestLLM(true);
                    setTimelineData([
                      {
                        color: "blue",
                        children: "Testing the configuration, please wait...",
                      },
                    ]);

                    let o = new OpenAiChannel(values, []);
                    let testBaseRes = await o.testBase().then(e => {
                      setTimelineData((x) => {
                        x.push({
                          color: "green",
                          children: t`Text Chat Test Success`,
                        });
                        return x.slice();
                      });
                      return true
                    }).catch(e => {
                      console.error(e);
                      setTimelineData((x) => {
                        x.push({
                          color: "red",
                          children: <Pre>{t`Text Chat Test Failed`}
                            <div className="text-red-500">{e.message}</div>
                          </Pre>,
                        });
                        return x.slice();
                      });
                      return false
                    })
                    if (testBaseRes) {
                      await o.testImage().then(() => {
                        setTimelineData((x) => {
                          x.push({
                            color: "green",
                            children: t`Image Support Test Success`,
                          });
                          return x.slice();
                        });
                        values.supportImage = true;
                      }).catch(e => {
                        console.error(e);
                        setTimelineData((x) => {
                          x.push({
                            color: "red",
                            children: <Pre>{t`Image Support Test Failed`}
                              <div className="text-red-500">{e.message}</div>
                            </Pre>,
                          });
                          return x.slice();
                        });
                        values.supportImage = false;
                      })


                      await o.testTool().then(() => {
                        setTimelineData((x) => {
                          x.push({
                            color: "green",
                            children: t`Tool Call Test Success`,
                          });
                          return x.slice();
                        });
                        values.supportTool = true;
                      }).catch(e => {
                        console.error(e);
                        setTimelineData((x) => {
                          x.push({
                            color: "red",
                            children: <Pre>{t`Tool Call Test Failed`}
                              <div className="text-red-500">{e.message}</div>
                            </Pre>,
                          });
                          return x.slice();
                        });
                        values.supportTool = false;
                      })
                      setPending(false);
                      setLoadingCheckLLM(false);

                    } else {
                      save = false;
                      setPending(false);
                      setLoadingCheckLLM(false);
                    }
                  }
                  if (save) {
                    if (values.key) {
                      let index = GPT_MODELS.get().data.findIndex(
                        (e) => e.key == values.key,
                      );
                      if (index == -1) {
                        return;
                      }
                      values.name = values.name || values.model;
                      GPT_MODELS.get().data[index] = values;
                      await GPT_MODELS.save();
                    } else {
                      values.name = values.name || values.model;
                      values.key = v4();
                      GPT_MODELS.get().data.push(values);
                      await GPT_MODELS.save();
                    }
                    refresh();
                    setIsAddModelConfigOpen(false);

                    setLoadingCheckLLM(false);
                    message.success("save success!");
                  }
                } catch {
                  setLoadingCheckLLM(false);
                  message.error("save failed!");
                }
              }}
            >
              {dom}
            </Form>
          )}
        >
          <Form.Item className="hidden" name="key" label="key">
            <Input></Input>
          </Form.Item>
          <Form.Item
            name="provider"
            label="Provider"
            rules={[{ required: true, message: "Please enter" }]}
          >
            <Select
              options={Providers}
              onChange={(e) => {
                setModelOptions([]);
                let find = Providers.find((x) => x.value == e);
                if (find == null) {
                  return;
                }

                let value: any = {
                };
                if (find.baseURL) {
                  value.baseURL = find.baseURL;
                }

                if (find.apiKey) {
                  value.apiKey = find.apiKey;
                }
                if (find.call_tool_step) {
                  value.call_tool_step = find.call_tool_step;
                }
                form.setFieldsValue(value);
                refresh();
              }}
            ></Select>
          </Form.Item>
          <Form.Item
            name="baseURL"
            label="baseURL"
            rules={[{ required: true, message: "Please enter" }]}
          >
            <Input placeholder={t`Please enter baseURL`}></Input>
          </Form.Item>
          <Form.Item
            name="apiKey"
            label="apiKey"
            rules={[{ required: true, message: "Please enter" }]}
          >
            <Input placeholder={t`Please enter apiKey`}></Input>
          </Form.Item>

          {modelOptions.length ? (
            <Form.Item
              name="model"
              label="model"
              rules={[{ required: true, message: "Please enter" }]}
            >
              <Select
                showSearch
                placeholder={t`Please enter or select the model`}
                optionFilterProp="label"
                onFocus={async () => {
                  const openai = new OpenAI({
                    baseURL: form.getFieldValue("baseURL"),
                    apiKey: form.getFieldValue("apiKey") || "",
                    dangerouslyAllowBrowser: true,
                  });
                  try {
                    const list = await openai.models.list();
                    setModelOptions(
                      list.data.map((x) => {
                        return { value: x.id, label: x.id };
                      }),
                    );
                    // console.log(list);
                  } catch {
                    setModelOptions([]);
                  }
                }}
                options={modelOptions}
              />
            </Form.Item>
          ) : (
            <Form.Item
              name="model"
              label="model"
              rules={[{ required: true, message: "Please enter" }]}
            >
              <Input
                placeholder={t`Please enter or select the model`}
                onFocus={async () => {
                  const openai = new OpenAI({
                    baseURL: form.getFieldValue("baseURL"),
                    apiKey: form.getFieldValue("apiKey") || "",
                    dangerouslyAllowBrowser: true,
                  });
                  try {
                    const list = await openai.models.list();
                    setModelOptions(
                      list.data.map((x) => {
                        return { value: x.id, label: x.id };
                      }),
                    );
                    // console.log(list);
                  } catch {
                    setModelOptions([]);
                  }
                }}
              ></Input>
            </Form.Item>
          )}
          <Form.Item name="name" label={t`Alias`}>
            <Input placeholder="The default is the model name"></Input>
          </Form.Item>


          <Form.Item
            name="type"
            label={t`type`}
            style={{
              display:
                form.getFieldValue("provider") == "openai" ||
                  form.getFieldValue("provider") == null
                  ? "block"
                  : "none",
            }}
          >
            <Select
              options={[
                {
                  label: t`LLM`,
                  value: "llm",
                },
                {
                  label: t`Embedding`,
                  value: "embedding",
                },
              ]}
              onChange={() => {
                refresh();
              }}
            ></Select>


          </Form.Item>

          {(form.getFieldValue("type") == "llm" ||
            form.getFieldValue("type") == null) && (<>

              <Form.Item name="call_tool_step" label={t`Call-Tool-Step`}>
                <InputNumber
                  style={{ width: "100%" }}
                  placeholder="default, the model is allowed to execute tools for 10 steps."
                ></InputNumber>
              </Form.Item>
              <Form.Item
                name="isStrict"
                label={t`CallToolStrictMode`}
              >
                <Switch></Switch>
              </Form.Item>

              {form.getFieldValue("key") && <Form.Item
                name="supportImage"
                label={t`supportImage`}
              >
                <Switch></Switch>
              </Form.Item>}
              {form.getFieldValue("key") && <Form.Item
                name="supportTool"
                label={t`supportTool`}
              >
                <Switch></Switch>
              </Form.Item>}

            </>)}

        </Modal>
        <Modal
          title="Test LLM"
          open={isOpenTestLLM}
          onOk={() => {
            setIsOpenTestLLM(false);
          }}
          cancelButtonProps={{ style: { display: "none" } }}
          onCancel={() => {
            setIsOpenTestLLM(false);
          }}
        >
          <Timeline
            pending={pending ? "Testing..." : ""}
            items={timelineData}
          />
        </Modal>
      </div>
    </ConfigProvider>
  );
}
